import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { email, newPassword } = await request.json();
    const adminClient = createAdminClient();

    // 이메일로 유저 찾기
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!profile) {
      return NextResponse.json({ error: '해당 이메일의 계정을 찾을 수 없습니다' }, { status: 404 });
    }

    // 비밀번호 변경
    const { error } = await adminClient.auth.admin.updateUserById(profile.id, {
      password: newPassword,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
