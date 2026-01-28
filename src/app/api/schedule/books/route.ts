import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, scheduleId, bookId, candidateId } = body;

    if (action === 'add_candidate') {
      // Add book to candidates
      const { error } = await supabase
        .from('schedule_book_candidates')
        .insert({
          schedule_id: scheduleId,
          book_id: bookId,
        });

      if (error) {
        console.error('Add candidate error:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'remove_candidate') {
      // Remove book from candidates
      const { error } = await supabase
        .from('schedule_book_candidates')
        .delete()
        .eq('id', candidateId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'vote') {
      // Vote for a book
      const { error } = await supabase
        .from('book_votes')
        .insert({
          schedule_id: scheduleId,
          book_id: bookId,
          user_id: user.id,
        });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'unvote') {
      // Remove vote for a book
      const { error } = await supabase
        .from('book_votes')
        .delete()
        .eq('schedule_id', scheduleId)
        .eq('book_id', bookId)
        .eq('user_id', user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'select_book') {
      // Select final book for schedule
      const { error: scheduleError } = await supabase
        .from('schedules')
        .update({ selected_book_id: bookId })
        .eq('id', scheduleId);

      if (scheduleError) {
        return NextResponse.json({ error: scheduleError.message }, { status: 400 });
      }

      // Update book status
      await supabase
        .from('books')
        .update({ status: 'selected' })
        .eq('id', bookId);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Schedule books API error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');

    if (!scheduleId) {
      return NextResponse.json({ error: 'Schedule ID required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get candidates
    const { data: candidates } = await supabase
      .from('schedule_book_candidates')
      .select('*, book:books(*)')
      .eq('schedule_id', scheduleId);

    // Get votes
    const { data: votes } = await supabase
      .from('book_votes')
      .select('book_id, user_id')
      .eq('schedule_id', scheduleId);

    // Get voter names
    let votesWithNames: any[] = [];
    if (votes && votes.length > 0) {
      const userIds = [...new Set(votes.map((v) => v.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p.name]) || []);
      votesWithNames = votes.map((v) => ({
        ...v,
        voter_name: profileMap.get(v.user_id) || '알 수 없음'
      }));
    }

    return NextResponse.json({
      candidates: candidates || [],
      votes: votesWithNames,
    });
  } catch (error) {
    console.error('Schedule books GET error:', error);
    return NextResponse.json({ candidates: [], votes: [] });
  }
}
