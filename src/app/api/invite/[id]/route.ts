import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

  const { error } = await admin.from('meeting_rsvps').insert({
    schedule_id: id,
    name: name.slice(0, 40),
    contact: (body.contact ?? '').trim().slice(0, 100) || null,
    message: (body.message ?? '').trim().slice(0, 300) || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
