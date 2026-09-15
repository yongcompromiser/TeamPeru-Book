import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, role } = await request.json();

    const { error } = await adminClient
      .from('profiles')
      .update({ role })
      .eq('id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin PATCH error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId } = await request.json();

    await adminClient.from('profiles').delete().eq('id', userId);
    await adminClient.auth.admin.deleteUser(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin DELETE error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// 관리자 페이지 데이터.
//
// 조회는 반드시 adminClient(service role)로 한다. 사용자 클라이언트로 profiles 를 읽으면
// RLS 정책에 따라 pending/guest 행이 조용히 빠져서, 가입 신청이 들어와도
// "승인 대기 0명 / 멤버 그대로"로만 보인다. (에러가 아니라 빈 결과로 오기 때문에 티가 안 난다)
export async function GET() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all users
    const { data: usersData, error: usersErr } = await adminClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersErr) {
      console.error('Admin 회원 목록 조회 실패:', usersErr.message);
      return NextResponse.json({ error: usersErr.message }, { status: 500 });
    }

    // Fetch stats
    const [
      { count: userCount },
      { count: bookCount },
      { count: scheduleCount },
      { count: discussionCount },
      { count: reviewCount },
      { count: recapCount },
    ] = await Promise.all([
      adminClient.from('profiles').select('*', { count: 'exact', head: true }).neq('role', 'pending'),
      adminClient.from('books').select('*', { count: 'exact', head: true }),
      adminClient.from('schedules').select('*', { count: 'exact', head: true }),
      adminClient.from('discussions').select('*', { count: 'exact', head: true }),
      adminClient.from('reviews').select('*', { count: 'exact', head: true }),
      adminClient.from('recaps').select('*', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      users: usersData || [],
      stats: {
        users: userCount || 0,
        books: bookCount || 0,
        schedules: scheduleCount || 0,
        discussions: discussionCount || 0,
        reviews: reviewCount || 0,
        recaps: recapCount || 0,
      }
    });
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
