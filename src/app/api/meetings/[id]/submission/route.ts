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
      // 수정. 공개 뒤에도 자기 글은 고칠 수 있다 — 모임 중에 평점을 바꾸고 싶은
      // 경우가 실제로 있었다. 대신 user_id 를 함께 걸어 남의 글은 못 건드리게 한다.
      // (RLS 만 믿으면 정책이 느슨할 때 조용히 통과한다)
      const { data, error } = await supabase
        .from('meeting_submissions')
        .update(submissionData)
        .eq('id', submissionId)
        .eq('user_id', user.id)
        .select()
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (!data) {
        return NextResponse.json(
          { error: '내가 쓴 글만 수정할 수 있습니다.' },
          { status: 403 }
        );
      }

      return NextResponse.json({ submission: data });
    } else {
      // 새로 생성. 공개된 뒤에 처음 쓰는 건 막는다 — 남의 발제를 다 보고 나서
      // 쓰는 글이라 같은 선상이 아니다. 수정은 위에서 허용한다.
      const { data: schedule } = await supabase
        .from('schedules')
        .select('is_revealed')
        .eq('id', scheduleId)
        .maybeSingle();

      if (schedule?.is_revealed) {
        return NextResponse.json(
          { error: '이미 공개된 모임입니다. 새로 작성할 수 없습니다.' },
          { status: 409 }
        );
      }

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
