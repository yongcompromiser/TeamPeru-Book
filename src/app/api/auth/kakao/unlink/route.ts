import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// 로그인된 사용자의 카카오 연결 해제 (kakao_id 제거).
// 카카오로만 가입한 계정(이메일이 @kakao.local)은 해제하면 로그인 수단이
// 사라지므로 막는다.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if ((user.email ?? '').endsWith('@kakao.local')) {
    return NextResponse.json(
      { error: '카카오로 가입한 계정은 연결을 해제할 수 없습니다.' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ kakao_id: null }).eq('id', user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
