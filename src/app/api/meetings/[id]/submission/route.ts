import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scheduleId } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { discussion, one_liner, rating, submissionId } = body;

    const submissionData = {
      schedule_id: scheduleId,
      user_id: user.id,
      discussion,
      one_liner,
      rating,
      updated_at: new Date().toISOString(),
    };

    if (submissionId) {
      // 수정
      const { data, error } = await supabase
        .from('meeting_submissions')
        .update(submissionData)
        .eq('id', submissionId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ submission: data });
    } else {
      // 새로 생성
      const { data, error } = await supabase
        .from('meeting_submissions')
        .insert(submissionData)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ submission: data });
    }
  } catch (error) {
    console.error('Submission API error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
