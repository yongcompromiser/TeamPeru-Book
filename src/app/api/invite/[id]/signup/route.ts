import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// 초대장에서 이메일로 가입하기.
//
// 카카오 참여와 달리 바로 입장시키지 않고 승인 대기(pending) 상태로 만든다.
// 이메일은 아무 주소나 넣을 수 있어 카카오보다 문턱이 낮기 때문이다.
// 다만 어느 모임 초대로 왔는지는 참석 명단에 남겨, 관리자가 보고 승인할 수 있게 한다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    // 공개된 초대장에서 온 요청만 받는다
    const { data: schedule } = await admin
      .from('schedules')
      .select('id, invite_public')
      .eq('id', id)
      .maybeSingle();
    if (!schedule || !schedule.invite_public) {
      return NextResponse.json({ error: '초대가 마감되었어요.' }, { status: 404 });
    }

    let body: { email?: string; password?: string; name?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    const email = (body.email ?? '').trim().toLowerCase();
    const password = body.password ?? '';
    const name = (body.name ?? '').trim().slice(0, 40);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '이메일 형식이 올바르지 않습니다.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });
    }

    // 이미 있는 계정이면 새로 만들지 않는다(비밀번호를 덮어쓰면 계정 탈취가 된다)
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: '이미 가입된 이메일입니다. 로그인해주세요.' },
        { status: 409 }
      );
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (createErr || !created?.user) {
      console.error('초대 가입 실패:', createErr?.message);
      return NextResponse.json({ error: '가입에 실패했어요. 잠시 후 다시 시도해주세요.' }, { status: 400 });
    }

    const userId = created.user.id;

    // 트리거가 만든 프로필에 이름을 확실히 넣는다. role 은 건드리지 않아 기본값(pending) 유지.
    await admin.from('profiles').upsert({ id: userId, email, name }, { onConflict: 'id' });

    // 어느 모임 초대로 왔는지 남긴다 — 관리자가 승인 판단에 쓴다
    try {
      await admin.from('meeting_rsvps').insert({
        schedule_id: id,
        user_id: userId,
        name,
      });
    } catch (e) {
      // 명단 등록 실패가 가입 자체를 막으면 안 된다
      console.error('초대 가입 명단 등록 실패:', e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Invite signup error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
