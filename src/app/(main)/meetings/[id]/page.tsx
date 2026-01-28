'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Calendar,
  Book,
  User,
  Star,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  Check,
  X,
  FileText,
  Send,
  Plus,
  Trash2,
  MessagesSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Schedule {
  id: string;
  title: string;
  meeting_date: string;
  presenter_id: string | null;
  selected_book_id: string | null;
  status: string;
  is_revealed: boolean;
  presenter?: { id: string; name: string };
  selected_book?: { id: string; title: string; author: string; cover_url?: string };
}

interface Submission {
  id: string;
  user_id: string;
  discussion: string | null;
  one_liner: string | null;
  rating: number | null;
  created_at: string;
  profile?: { name: string; avatar_url?: string };
}

interface SubmissionStatus {
  user_id: string;
  user_name: string;
  has_submitted: boolean;
  char_count: number;
  has_rating: boolean;
  has_one_liner: boolean;
}

interface Comment {
  id: string;
  submission_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { name: string };
}

interface MeetingComment {
  id: string;
  schedule_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { name: string };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MeetingDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const supabase = createClient();
  const { user, profile } = useAuth();

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionStatuses, setSubmissionStatuses] = useState<SubmissionStatus[]>([]);
  const [mySubmission, setMySubmission] = useState<Submission | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [meetingComments, setMeetingComments] = useState<MeetingComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);

  // 작성 폼 상태
  const [discussions, setDiscussions] = useState<string[]>(['']);
  const [oneLiner, setOneLiner] = useState('');
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);

  // 댓글 상태
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // 모임 댓글 상태
  const [meetingCommentInput, setMeetingCommentInput] = useState('');
  const [isSubmittingMeetingComment, setIsSubmittingMeetingComment] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const isPresenter = schedule?.presenter_id === user?.id;
  const canReveal = isAdmin || isPresenter;
  const meetingDay = schedule ? new Date(schedule.meeting_date) : null;
  const today = new Date();
  const isOnOrAfterMeetingDay = meetingDay
    ? meetingDay.toDateString() <= today.toDateString()
    : false;

  useEffect(() => {
    if (id) {
      fetchMeetingData();
      fetchMeetingComments();
    }
  }, [id, user]);

  const fetchMeetingData = async () => {
    // API를 통해 먼저 시도
    try {
      const res = await fetch(`/api/meetings/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSchedule(data.schedule);

        if (data.submissions) {
          const mine = data.submissions.find((s: Submission) => s.user_id === user?.id);
          if (mine) {
            setMySubmission(mine);
            try {
              const parsed = JSON.parse(mine.discussion || '[]');
              setDiscussions(Array.isArray(parsed) && parsed.length > 0 ? parsed : ['']);
            } catch {
              setDiscussions(mine.discussion ? [mine.discussion] : ['']);
            }
            setOneLiner(mine.one_liner || '');
            setRating(mine.rating || 0);
          }

          if (data.schedule.is_revealed) {
            setSubmissions(data.submissions);
            setComments(data.comments || []);
          } else {
            setSubmissions(mine ? [mine] : []);
          }

          // 제출 현황
          const statuses: SubmissionStatus[] = data.submissions.map((submission: Submission) => {
            const member = (data.allMembers || []).find((m: { id: string }) => m.id === submission.user_id);
            let charCount = 0;
            try {
              const parsed = JSON.parse(submission.discussion || '[]');
              charCount = Array.isArray(parsed) ? parsed.join('').length : (submission.discussion?.length || 0);
            } catch {
              charCount = submission.discussion?.length || 0;
            }
            return {
              user_id: submission.user_id,
              user_name: member?.name || '알 수 없음',
              has_submitted: true,
              char_count: charCount,
              has_rating: !!submission.rating,
              has_one_liner: !!submission.one_liner,
            };
          });
          setSubmissionStatuses(statuses);
        }

        setIsLoading(false);
        return;
      }
    } catch (e) {
      console.log('API fetch failed, trying direct');
    }

    // API 실패시 직접 호출
    const { data: scheduleData } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', id)
      .single();

    if (!scheduleData) {
      setIsLoading(false);
      return;
    }

    let presenter = null;
    if (scheduleData.presenter_id) {
      const { data: p } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('id', scheduleData.presenter_id)
        .single();
      presenter = p;
    }

    let selected_book = null;
    if (scheduleData.selected_book_id) {
      const { data: b } = await supabase
        .from('books')
        .select('id, title, author, cover_url')
        .eq('id', scheduleData.selected_book_id)
        .single();
      selected_book = b;
    }

    setSchedule({ ...scheduleData, presenter, selected_book });

    const { data: allMembers } = await supabase
      .from('profiles')
      .select('id, name')
      .in('role', ['admin', 'member']);

    // 제출물 조회
    const { data: submissionsData } = await supabase
      .from('meeting_submissions')
      .select('*, profile:profiles(name, avatar_url)')
      .eq('schedule_id', id);

    if (submissionsData) {
      const mine = submissionsData.find((s: Submission) => s.user_id === user?.id);
      if (mine) {
        setMySubmission(mine);
        // discussion이 JSON 배열 형태인지 확인
        try {
          const parsed = JSON.parse(mine.discussion || '[]');
          setDiscussions(Array.isArray(parsed) && parsed.length > 0 ? parsed : ['']);
        } catch {
          // 기존 문자열 형태면 배열로 변환
          setDiscussions(mine.discussion ? [mine.discussion] : ['']);
        }
        setOneLiner(mine.one_liner || '');
        setRating(mine.rating || 0);
      }

      // 공개된 경우 전체 표시
      if (scheduleData.is_revealed) {
        setSubmissions(submissionsData);

        // 댓글 조회
        const submissionIds = submissionsData.map((s: Submission) => s.id);
        if (submissionIds.length > 0) {
          const { data: commentsData } = await supabase
            .from('submission_comments')
            .select('*, profile:profiles(name)')
            .in('submission_id', submissionIds)
            .order('created_at', { ascending: true });
          setComments(commentsData || []);
        }
      } else {
        setSubmissions(mine ? [mine] : []);
      }

      // 제출 현황 - 작성한 회원만 표시
      const statuses: SubmissionStatus[] = submissionsData.map((submission: Submission) => {
        const member = (allMembers || []).find((m: { id: string }) => m.id === submission.user_id);
        let charCount = 0;
        try {
          const parsed = JSON.parse(submission.discussion || '[]');
          charCount = Array.isArray(parsed)
            ? parsed.reduce((sum, d) => sum + (d?.length || 0), 0)
            : (submission.discussion?.length || 0);
        } catch {
          charCount = submission.discussion?.length || 0;
        }
        charCount += submission.one_liner?.length || 0;

        return {
          user_id: submission.user_id,
          user_name: member?.name || '알 수 없음',
          has_submitted: true,
          char_count: charCount,
          has_rating: !!submission.rating,
          has_one_liner: !!submission.one_liner,
        };
      });
      setSubmissionStatuses(statuses);
    }

    setIsLoading(false);
  };

  const fetchMeetingComments = async () => {
    try {
      const res = await fetch(`/api/meetings/${id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setMeetingComments(data.comments || []);
      }
    } catch (e) {
      console.log('Failed to fetch meeting comments');
    }
  };

  const handleAddMeetingComment = async () => {
    if (!meetingCommentInput.trim() || !user) return;

    setIsSubmittingMeetingComment(true);

    try {
      const res = await fetch(`/api/meetings/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: meetingCommentInput }),
      });

      const data = await res.json();

      if (res.ok && data.comment) {
        setMeetingComments(prev => [...prev, data.comment]);
        setMeetingCommentInput('');
      } else {
        console.error('Meeting comment error:', data.error);
        alert(data.error || '메시지 전송에 실패했습니다');
      }
    } catch (e) {
      console.error('Failed to add meeting comment:', e);
      alert('메시지 전송에 실패했습니다');
    }

    setIsSubmittingMeetingComment(false);
  };

  const handleSaveSubmission = async () => {
    if (!user || !schedule) return;

    setIsSaving(true);

    // 빈 발제 제거하고 JSON으로 저장
    const filteredDiscussions = discussions.filter(d => d.trim());
    const discussionJson = filteredDiscussions.length > 0
      ? JSON.stringify(filteredDiscussions)
      : null;

    // API를 통해 먼저 시도
    try {
      const res = await fetch(`/api/meetings/${schedule.id}/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discussion: discussionJson,
          one_liner: oneLiner || null,
          rating: rating || null,
          submissionId: mySubmission?.id || null,
        }),
      });

      if (res.ok) {
        await fetchMeetingData();
        setIsSaving(false);
        return;
      }
    } catch (e) {
      console.log('API save failed, trying direct');
    }

    // API 실패시 직접 호출
    const submissionData = {
      schedule_id: schedule.id,
      user_id: user.id,
      discussion: discussionJson,
      one_liner: oneLiner || null,
      rating: rating || null,
      updated_at: new Date().toISOString(),
    };

    if (mySubmission) {
      await supabase
        .from('meeting_submissions')
        .update(submissionData)
        .eq('id', mySubmission.id);
    } else {
      await supabase
        .from('meeting_submissions')
        .insert(submissionData);
    }

    await fetchMeetingData();
    setIsSaving(false);
  };

  const handleAddDiscussion = () => {
    setDiscussions([...discussions, '']);
  };

  const handleRemoveDiscussion = (index: number) => {
    if (discussions.length > 1) {
      setDiscussions(discussions.filter((_, i) => i !== index));
    }
  };

  const handleDiscussionChange = (index: number, value: string) => {
    const newDiscussions = [...discussions];
    newDiscussions[index] = value;
    setDiscussions(newDiscussions);
  };

  const getTotalCharCount = () => {
    return discussions.reduce((sum, d) => sum + d.length, 0);
  };

  const handleReveal = async () => {
    if (!schedule || !canReveal) return;

    if (!confirm('모든 참여자의 발제와 평점을 공개하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    setIsRevealing(true);

    try {
      const res = await fetch(`/api/meetings/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reveal' }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || '공개 처리에 실패했습니다.');
        setIsRevealing(false);
        return;
      }
    } catch (e) {
      console.log('API reveal failed, trying direct');
      // API 실패시 직접 호출
      if (schedule.selected_book_id) {
        await supabase
          .from('books')
          .update({ status: 'completed' })
          .eq('id', schedule.selected_book_id);
      }

      await supabase
        .from('schedules')
        .update({ is_revealed: true })
        .eq('id', schedule.id);
    }

    await fetchMeetingData();
    setIsRevealing(false);
  };

  const handleAddComment = async (submissionId: string) => {
    const content = commentInputs[submissionId]?.trim();
    if (!content || !user) return;

    setIsSubmittingComment(true);

    await supabase.from('submission_comments').insert({
      submission_id: submissionId,
      user_id: user.id,
      content,
    });

    setCommentInputs(prev => ({ ...prev, [submissionId]: '' }));
    await fetchMeetingData();
    setIsSubmittingComment(false);
  };

  const renderStars = (value: number, interactive: boolean = false) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const filled = interactive ? (hoverRating || rating) >= i : value >= i;
      const halfFilled = interactive
        ? (hoverRating || rating) >= i - 0.5 && (hoverRating || rating) < i
        : value >= i - 0.5 && value < i;

      stars.push(
        <span
          key={i}
          className={cn(
            "relative cursor-pointer text-2xl",
            interactive && "hover:scale-110 transition-transform"
          )}
          onMouseEnter={() => interactive && setHoverRating(i)}
          onMouseLeave={() => interactive && setHoverRating(0)}
          onClick={() => interactive && setRating(rating === i ? i - 0.5 : i)}
        >
          <Star
            className={cn(
              "w-6 h-6",
              filled ? "fill-yellow-400 text-yellow-400" :
              halfFilled ? "fill-yellow-400/50 text-yellow-400" :
              "text-gray-300"
            )}
          />
        </span>
      );
    }
    return <div className="flex gap-1">{stars}</div>;
  };

  const getCommentsForSubmission = (submissionId: string) => {
    return comments.filter(c => c.submission_id === submissionId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">모임을 찾을 수 없습니다</p>
        <Link href="/meetings" className="text-blue-600 hover:underline mt-2 inline-block">
          모임 목록으로
        </Link>
      </div>
    );
  }

  const meetingDate = new Date(schedule.meeting_date);
  const submittedCount = submissionStatuses.filter(s => s.has_submitted).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link
        href="/meetings"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        모임 목록으로
      </Link>

      {/* 모임 정보 헤더 */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-6">
            <div className="flex-shrink-0 w-24 h-36 rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 shadow-md">
              {schedule.selected_book?.cover_url ? (
                <img
                  src={schedule.selected_book.cover_url}
                  alt={schedule.selected_book.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600">
                  <Book className="w-8 h-8 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <Calendar className="w-4 h-4" />
                <span>{format(meetingDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })}</span>
              </div>

              {schedule.selected_book ? (
                <>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {schedule.selected_book.title}
                  </h1>
                  <p className="text-gray-600 mt-1">{schedule.selected_book.author}</p>
                </>
              ) : (
                <h1 className="text-2xl font-bold text-gray-500">책 미선정</h1>
              )}

              {schedule.presenter && (
                <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                  <User className="w-4 h-4" />
                  발제자: {schedule.presenter.name}
                </p>
              )}

              <div className="mt-4 flex items-center gap-3">
                {schedule.is_revealed ? (
                  <span className="inline-flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
                    <Eye className="w-4 h-4" />
                    공개됨
                  </span>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">
                      <EyeOff className="w-4 h-4" />
                      비공개
                    </span>
                    {canReveal && (
                      <Button
                        onClick={handleReveal}
                        disabled={isRevealing || !isOnOrAfterMeetingDay}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                      >
                        {isRevealing ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Eye className="w-4 h-4 mr-2" />
                        )}
                        {isOnOrAfterMeetingDay ? '모임진행 (공개하기)' : '모임 당일 공개 가능'}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 제출 현황 (공개 전에도 표시) */}
      {!schedule.is_revealed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              제출 현황 ({submittedCount}/{submissionStatuses.length}명)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {submissionStatuses.map((status) => (
                <div
                  key={status.user_id}
                  className={cn(
                    "p-3 rounded-lg border-2 transition-all",
                    status.has_submitted
                      ? "border-green-200 bg-green-50"
                      : "border-gray-200 bg-gray-50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {status.has_submitted ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <X className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={cn(
                      "font-medium text-sm",
                      status.has_submitted ? "text-green-700" : "text-gray-500"
                    )}>
                      {status.user_name}
                    </span>
                  </div>
                  {status.has_submitted && (
                    <div className="text-xs text-gray-500 space-y-0.5 ml-6">
                      <p>{status.char_count}자 작성</p>
                      <div className="flex gap-2">
                        {status.has_rating && <span className="text-yellow-600">★평점</span>}
                        {status.has_one_liner && <span className="text-blue-600">한줄평</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 내 발제 작성 (공개 전에만 수정 가능) */}
      {!schedule.is_revealed && user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              나의 발제 작성
              <span className="text-sm font-normal text-gray-500">(내용은 공개 전까지 숨겨집니다)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                평점 (0.5점 단위로 클릭)
              </label>
              <div className="flex items-center gap-3">
                {renderStars(rating, true)}
                <span className="text-sm text-gray-600">{rating > 0 ? `${rating}점` : '선택 안 함'}</span>
                {rating > 0 && (
                  <button
                    onClick={() => setRating(0)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    초기화
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                한줄평
              </label>
              <input
                type="text"
                value={oneLiner}
                onChange={(e) => setOneLiner(e.target.value)}
                placeholder="이 책을 한 문장으로 표현한다면?"
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                발제 내용 <span className="text-gray-400">(총 {getTotalCharCount()}자)</span>
              </label>
              <div className="space-y-3">
                {discussions.map((disc, index) => (
                  <div key={index} className="relative">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500">발제 {index + 1}</span>
                      <span className="text-xs text-gray-400">({disc.length}자)</span>
                      {discussions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDiscussion(index)}
                          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          삭제
                        </button>
                      )}
                    </div>
                    <textarea
                      value={disc}
                      onChange={(e) => handleDiscussionChange(index, e.target.value)}
                      placeholder="토론하고 싶은 주제나 인상 깊었던 부분을 작성해주세요..."
                      className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-24"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveSubmission} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {mySubmission ? '수정하기' : '저장하기'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddDiscussion}
              >
                <Plus className="w-4 h-4 mr-1" />
                발제 추가하기
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 참여자들의 발제 (공개된 경우) - 댓글 포함 */}
      {schedule.is_revealed && submissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              참여자 발제 ({submissions.length}명)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {submissions.map((submission) => {
              const submissionComments = getCommentsForSubmission(submission.id);
              return (
                <div key={submission.id} className="border rounded-lg overflow-hidden">
                  {/* 발제 내용 */}
                  <div className="p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="font-medium text-gray-900">
                          {submission.profile?.name || '알 수 없음'}
                        </span>
                      </div>
                      {submission.rating && (
                        <div className="flex items-center gap-1">
                          {renderStars(submission.rating)}
                          <span className="text-sm text-gray-600 ml-1">{submission.rating}</span>
                        </div>
                      )}
                    </div>

                    {submission.one_liner && (
                      <p className="text-blue-600 font-medium mb-2 italic">
                        "{submission.one_liner}"
                      </p>
                    )}

                    {submission.discussion && (() => {
                      let discussionList: string[] = [];
                      try {
                        const parsed = JSON.parse(submission.discussion);
                        discussionList = Array.isArray(parsed) ? parsed : [submission.discussion];
                      } catch {
                        discussionList = [submission.discussion];
                      }
                      return (
                        <div className="space-y-3">
                          {discussionList.map((disc, idx) => (
                            <div key={idx}>
                              {discussionList.length > 1 && (
                                <p className="text-xs text-gray-500 mb-1">발제 {idx + 1}</p>
                              )}
                              <p className="text-gray-700 whitespace-pre-wrap">{disc}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* 댓글 영역 */}
                  <div className="border-t bg-white p-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      댓글 {submissionComments.length > 0 && `(${submissionComments.length})`}
                    </p>

                    {/* 댓글 목록 */}
                    {submissionComments.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {submissionComments.map((comment) => (
                          <div key={comment.id} className="flex gap-2 text-sm">
                            <span className="font-medium text-gray-900">
                              {comment.profile?.name}:
                            </span>
                            <span className="text-gray-700">{comment.content}</span>
                            <span className="text-gray-400 text-xs">
                              {format(new Date(comment.created_at), 'M/d HH:mm')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 댓글 입력 */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={commentInputs[submission.id] || ''}
                        onChange={(e) => setCommentInputs(prev => ({
                          ...prev,
                          [submission.id]: e.target.value
                        }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment(submission.id);
                          }
                        }}
                        placeholder="댓글을 입력하세요..."
                        className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleAddComment(submission.id)}
                        disabled={isSubmittingComment || !commentInputs[submission.id]?.trim()}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 모임 기록 채팅 (공개된 경우만) */}
      {schedule.is_revealed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessagesSquare className="w-5 h-5" />
              모임 기록
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* 채팅 메시지 목록 */}
            <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
              {meetingComments.length > 0 ? (
                meetingComments.map((comment) => (
                  <div
                    key={comment.id}
                    className={cn(
                      "flex gap-3 p-3 rounded-lg",
                      comment.user_id === user?.id
                        ? "bg-blue-50 ml-8"
                        : "bg-gray-50 mr-8"
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-gray-900">
                          {comment.profile?.name || '알 수 없음'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(comment.created_at), 'M/d HH:mm')}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm whitespace-pre-wrap break-words">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MessagesSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>아직 기록이 없습니다</p>
                  <p className="text-sm">모임 중 자유롭게 소통하고 기록해보세요!</p>
                </div>
              )}
            </div>

            {/* 입력 영역 */}
            {user && (
              <div className="flex gap-2 border-t pt-4">
                <input
                  type="text"
                  value={meetingCommentInput}
                  onChange={(e) => setMeetingCommentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddMeetingComment();
                    }
                  }}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Button
                  onClick={handleAddMeetingComment}
                  disabled={isSubmittingMeetingComment || !meetingCommentInput.trim()}
                >
                  {isSubmittingMeetingComment ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
