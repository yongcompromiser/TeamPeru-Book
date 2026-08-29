import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// 공개 초대 페이지용 API (로그인 불필요).
// GET: invite_public=true 인 모임의 "공개해도 되는" 최소 정보만 반환.
// POST: 게스트 참석 신청(RSVP) 저장.

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: schedule } = await admin
    .from('schedules')
    .select('id, title, meeting_date, meeting_time, location, invite_public, presenter_id, selected_book_id')
    .eq('id', id)
    .maybeSingle();

  // 공개로 지정된 모임만 노출
  if (!schedule || !schedule.invite_public) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let presenterName: string | null = null;
  if (schedule.presenter_id) {
    const { data: p } = await admin
      .from('profiles')
      .select('name')
      .eq('id', schedule.presenter_id)
      .maybeSingle();
    presenterName = p?.name ?? null;
  }

  let book: { title: string; author: string; cover_url: string | null } | null = null;
  if (schedule.selected_book_id) {
    const { data: b } = await admin
      .from('books')
      .select('title, author, cover_url')
      .eq('id', schedule.selected_book_id)
      .maybeSingle();
    book = b ?? null;
  }

  // 이미 신청한 인원 수 (이름/연락처 등 개인정보는 공개 API에서 노출하지 않음)
  const { count } = await admin
    .from('meeting_rsvps')
    .select('id', { count: 'exact', head: true })
    .eq('schedule_id', id)
    .neq('status', 'cancelled');

  return NextResponse.json({
    meeting: {
      id: schedule.id,
      title: schedule.title,
      meeting_date: schedule.meeting_date,
      meeting_time: schedule.meeting_time ?? null,
      location: schedule.location ?? null,
      presenter_name: presenterName,
      book,
      rsvp_count: count ?? 0,
    },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  // 공개 모임인지 먼저 확인
  const { data: schedule } = await admin
    .from('schedules')
    .select('id, invite_public')
    .eq('id', id)
    .maybeSingle();
  if (!schedule || !schedule.invite_public) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let body: { name?: string; contact?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  if (!name) {
    return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });
  }
  const cleanName = name.slice(0, 40);
  const cleanContact = (body.contact ?? '').trim().slice(0, 100) || null;
  const cleanMessage = (body.message ?? '').trim().slice(0, 300) || null;

  // 로그인 상태면 계정 연결(스키마 user_id 채우기), 아니면 익명
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    /* 익명 신청 */
  }

  // 정원 상한 — 무제한 반복 제출(flood) 방지
  const { count } = await admin
    .from('meeting_rsvps')
    .select('id', { count: 'exact', head: true })
    .eq('schedule_id', id)
    .neq('status', 'cancelled');
  if ((count ?? 0) >= 300) {
    return NextResponse.json({ error: '참석 신청이 마감되었어요.' }, { status: 400 });
  }

  // 중복 신청 방지: 같은 신청자(로그인 계정 우선, 아니면 이름+연락처)가 이미 있으면 갱신
  let dupQuery = admin
    .from('meeting_rsvps')
    .select('id')
    .eq('schedule_id', id)
    .neq('status', 'cancelled');
  if (userId) {
    dupQuery = dupQuery.eq('user_id', userId);
  } else {
    dupQuery = dupQuery.eq('name', cleanName);
    dupQuery = cleanContact ? dupQuery.eq('contact', cleanContact) : dupQuery.is('contact', null);
  }
  const { data: dups } = await dupQuery.limit(1);
  if (dups && dups.length > 0) {
    await admin
      .from('meeting_rsvps')
      .update({ name: cleanName, contact: cleanContact, message: cleanMessage })
      .eq('id', dups[0].id);
    return NextResponse.json({ success: true });
  }

  const { error } = await admin.from('meeting_rsvps').insert({
    schedule_id: id,
    user_id: userId,
    name: cleanName,
    contact: cleanContact,
    message: cleanMessage,
  });

  if (error) {
    console.error('RSVP insert error:', error);
    return NextResponse.json({ error: '신청에 실패했어요. 잠시 후 다시 시도해주세요.' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
