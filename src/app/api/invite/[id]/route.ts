import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// 공개 초대 페이지용 API.
// GET: invite_public=true 인 모임의 "공개해도 되는" 최소 정보만 반환 (로그인 불필요).
// DELETE: 참석 신청 삭제 (관리자 전용).
//
// 익명 참석 신청(POST)은 없앴다. 누가 오는지 확인할 길이 없고 장난 신청도 막기 어려워
// 참여를 카카오로만 받기로 했다. 참석 명단 등록은 카카오 콜백에서 처리한다.
// (src/app/api/auth/kakao/callback/route.ts)

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


// 참석 신청 삭제 (관리자 전용).
// 장난 신청이나 테스트로 들어온 것을 지운다.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const admin = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: '관리자만 삭제할 수 있습니다.' }, { status: 403 });
    }

    const { rsvpId } = await request.json();
    if (!rsvpId) {
      return NextResponse.json({ error: 'rsvpId required' }, { status: 400 });
    }

    // schedule_id 도 함께 걸어 다른 모임의 신청이 지워지지 않게 한다
    const { error } = await admin
      .from('meeting_rsvps')
      .delete()
      .eq('id', rsvpId)
      .eq('schedule_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('RSVP delete error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
