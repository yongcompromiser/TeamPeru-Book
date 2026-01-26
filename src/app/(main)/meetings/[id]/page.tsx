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
  Upload,
  Loader2,
  MessageSquare,
  Mic,
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
  profile?: { name: string; avatar_url?: string };
}

interface MeetingRecord {
  id: string;
  audio_url: string | null;
  transcript: string | null;
  summary: string | null;
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
  const [mySubmission, setMySubmission] = useState<Submission | null>(null);
  const [records, setRecords] = useState<MeetingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);

  // 작성 폼 상태
  const [discussion, setDiscussion] = useState('');
  const [oneLiner, setOneLiner] = useState('');
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);

  const isAdmin = profile?.role === 'admin';
  const isPresenter = schedule?.presenter_id === user?.id;
  const canReveal = isAdmin || isPresenter;
  const isPast = schedule ? new Date(schedule.meeting_date) < new Date() : false;

  useEffect(() => {
    if (id) {
      fetchMeetingData();
    }
  }, [id, user]);

  const fetchMeetingData = async () => {
    // 스케줄 정보
    const { data: scheduleData } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', id)
      .single();

    if (!scheduleData) {
      setIsLoading(false);
      return;
    }

    // 발제자 정보
    let presenter = null;
    if (scheduleData.presenter_id) {
      const { data: p } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('id', scheduleData.presenter_id)
        .single();
      presenter = p;
    }

    // 책 정보
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

    // 제출물 조회 (공개된 경우 전체, 아니면 본인 것만)
    const { data: submissionsData } = await supabase
      .from('meeting_submissions')
      .select('*, profile:profiles(name, avatar_url)')
      .eq('schedule_id', id);

    if (submissionsData) {
      // 본인 제출물 찾기
      const mine = submissionsData.find(s => s.user_id === user?.id);
      if (mine) {
        setMySubmission(mine);
        setDiscussion(mine.discussion || '');
        setOneLiner(mine.one_liner || '');
        setRating(mine.rating || 0);
      }

      // 공개된 경우에만 다른 사람 제출물 표시
      if (scheduleData.is_revealed) {
        setSubmissions(submissionsData);
      } else {
        setSubmissions(mine ? [mine] : []);
      }
    }

    // 모임 기록 조회
    const { data: recordsData } = await supabase
      .from('meeting_records')
      .select('*')
      .eq('schedule_id', id);

    setRecords(recordsData || []);
    setIsLoading(false);
  };

  const handleSaveSubmission = async () => {
    if (!user || !schedule) return;

    setIsSaving(true);

    const submissionData = {
      schedule_id: schedule.id,
      user_id: user.id,
      discussion: discussion || null,
      one_liner: oneLiner || null,
      rating: rating || null,
      updated_at: new Date().toISOString(),
    };

    if (mySubmission) {
      // 업데이트
      await supabase
        .from('meeting_submissions')
        .update(submissionData)
        .eq('id', mySubmission.id);
    } else {
      // 새로 생성
      await supabase
        .from('meeting_submissions')
        .insert(submissionData);
    }

    await fetchMeetingData();
    setIsSaving(false);
  };

  const handleReveal = async () => {
    if (!schedule || !canReveal) return;

    if (!confirm('모든 참여자의 발제와 평점을 공개하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    setIsRevealing(true);

    // 책 상태를 completed로 변경
    if (schedule.selected_book_id) {
      await supabase
        .from('books')
        .update({ status: 'completed' })
        .eq('id', schedule.selected_book_id);
    }

    // 모임 공개
    await supabase
      .from('schedules')
      .update({ is_revealed: true })
      .eq('id', schedule.id);

    await fetchMeetingData();
    setIsRevealing(false);
  };

  // 별점 렌더링 (0.5 단위)
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
            {/* 책 이미지 */}
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

            {/* 모임 정보 */}
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

              {/* 공개 상태 및 버튼 */}
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
                    {canReveal && isPast && (
                      <Button
                        onClick={handleReveal}
                        disabled={isRevealing}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isRevealing ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Eye className="w-4 h-4 mr-2" />
                        )}
                        모임진행 (공개하기)
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 내 발제 작성 (공개 전에만 수정 가능) */}
      {!schedule.is_revealed && user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              나의 발제 작성
              <span className="text-sm font-normal text-gray-500">(다른 사람에게 보이지 않습니다)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 평점 */}
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

            {/* 한줄평 */}
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

            {/* 발제 내용 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                발제 내용
              </label>
              <textarea
                value={discussion}
                onChange={(e) => setDiscussion(e.target.value)}
                placeholder="토론하고 싶은 주제나 인상 깊었던 부분을 작성해주세요..."
                className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-32"
              />
            </div>

            <Button onClick={handleSaveSubmission} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {mySubmission ? '수정하기' : '저장하기'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 참여자들의 발제 (공개된 경우) */}
      {schedule.is_revealed && submissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              참여자 발제 ({submissions.length}명)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {submissions.map((submission) => (
              <div
                key={submission.id}
                className="p-4 border rounded-lg bg-gray-50"
              >
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

                {submission.discussion && (
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {submission.discussion}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 모임 기록 (음성) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mic className="w-5 h-5" />
            모임 기록
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length > 0 ? (
            <div className="space-y-4">
              {records.map((record) => (
                <div key={record.id} className="p-4 border rounded-lg">
                  {record.audio_url && (
                    <audio controls className="w-full mb-3">
                      <source src={record.audio_url} />
                    </audio>
                  )}
                  {record.summary && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">AI 요약</h4>
                      <p className="text-gray-700 whitespace-pre-wrap">{record.summary}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Mic className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>아직 기록이 없습니다</p>
              {(isAdmin || isPresenter) && (
                <Button variant="outline" className="mt-4">
                  <Upload className="w-4 h-4 mr-2" />
                  음성 파일 업로드
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
