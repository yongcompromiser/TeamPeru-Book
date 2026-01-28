import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all users
    const { data: usersData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    // Fetch stats
    const [
      { count: userCount },
      { count: bookCount },
      { count: scheduleCount },
      { count: discussionCount },
      { count: reviewCount },
      { count: recapCount },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).neq('role', 'pending'),
      supabase.from('books').select('*', { count: 'exact', head: true }),
      supabase.from('schedules').select('*', { count: 'exact', head: true }),
      supabase.from('discussions').select('*', { count: 'exact', head: true }),
      supabase.from('reviews').select('*', { count: 'exact', head: true }),
      supabase.from('recaps').select('*', { count: 'exact', head: true }),
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
