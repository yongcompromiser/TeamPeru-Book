import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type Admin = ReturnType<typeof createAdminClient>;

/**
 * auth.users 에서 이메일로 계정을 찾는다.
 *
 * profiles 에는 없는데 auth.users 에는 남아 있는 "반쯤 만들어진" 계정이 생길 수 있다.
 * (프로필 생성 트리거가 실패했거나 이전 시도가 중간에 끊긴 경우)
 * 그 상태면 createUser 가 계속 already registered 로 실패해서 영영 가입이 안 된다.
 * supabase-js 의 admin API 는 이메일 필터가 없어 페이지를 훑는다 — 소규모 모임이라 충분하다.
 */
async function findAuthUserByEmail(admin: Admin, email: string) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? '').toLowerCase() === email);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

const isAlreadyRegistered = (msg: string) =>
  /already.*(registered|exists)|email_exists|duplicate key/i.test(msg);

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

    const userId = created?.user?.id;

    if (createErr || !userId) {
      const msg = createErr?.message ?? '알 수 없는 오류';
      console.error('초대 가입 실패:', msg);

      // auth.users 에는 있는데 profiles 에는 없는 상태면 프로필만 복구해준다.
      // 비밀번호는 절대 덮어쓰지 않는다(덮어쓰면 남의 계정을 가져갈 수 있다).
      if (isAlreadyRegistered(msg)) {
        const existingAuth = await findAuthUserByEmail(admin, email);
        if (existingAuth) {
          await admin
            .from('profiles')
            .upsert({ id: existingAuth.id, email, name }, { onConflict: 'id' });
          return NextResponse.json(
            { error: '이미 가입된 이메일입니다. 로그인해주세요.' },
            { status: 409 }
          );
        }
      }

      // 원인을 화면에서 바로 알 수 있게 실제 사유도 같이 내려준다.
      // (소규모 비공개 모임용이고, 이게 없으면 서버 로그를 봐야만 진단이 된다)
      return NextResponse.json(
        { error: '가입에 실패했어요. 잠시 후 다시 시도해주세요.', detail: msg },
        { status: 400 }
      );
    }

    // 트리거가 만든 프로필에 이름을 확실히 넣는다. role 은 건드리지 않아 기본값(pending) 유지.
    // 여기가 실패하면 로그인은 되는데 관리자 화면 어디에도 안 뜨는 유령 계정이 된다.
    const { error: profileErr } = await admin
      .from('profiles')
      .upsert({ id: userId, email, name }, { onConflict: 'id' });
    if (profileErr) {
      console.error('초대 가입 프로필 생성 실패:', profileErr.message);
      return NextResponse.json(
        { error: '가입 처리 중 문제가 생겼어요. 관리자에게 알려주세요.', detail: profileErr.message },
        { status: 500 }
      );
    }

    // 어느 모임 초대로 왔는지 남긴다 — 관리자가 승인 판단에 쓴다.
    // 실패해도 가입 자체는 살린다(승인 대기 목록에는 이미 떠 있다). 대신 로그는 남긴다.
    // supabase-js 는 throw 하지 않고 error 를 돌려주므로 반드시 error 를 본다.
    const { error: rsvpErr } = await admin.from('meeting_rsvps').insert({
      schedule_id: id,
      user_id: userId,
      name,
    });
    if (rsvpErr) console.error('초대 가입 명단 등록 실패:', rsvpErr.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Invite signup error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
