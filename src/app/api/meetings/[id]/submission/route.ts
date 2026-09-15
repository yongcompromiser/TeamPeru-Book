import { createClient } from '@/lib/supabase/server';
import { getViewer, canSubmitToMeeting } from '@/lib/permissions';
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

    // 게스트는 초대받은 모임에만 제출할 수 있다(참석 명단에 있는지로 판정).
    // 정회원·관리자는 모든 모임에 제출할 수 있다.
    const viewer = await getViewer();
    if (!(await canSubmitToMeeting(viewer, scheduleId))) {
      return NextResponse.json(
        { error: '초대받은 모임에만 작성할 수 있습니다.' },
        { status: 403 }
      );
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
