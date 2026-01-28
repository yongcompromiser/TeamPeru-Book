'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Book, ChevronRight, LayoutGrid, Table, MapPin, Clock, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Rating {
  name: string;
  rating: number;
}

interface Schedule {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time?: string;
  location?: string;
  presenter_id: string | null;
  selected_book_id: string | null;
  status: string;
  is_revealed: boolean;
  presenter?: { name: string };
  selected_book?: { title: string; author: string; cover_url?: string };
  ratings?: Rating[];
}

export default function MeetingsPage() {
  const supabase = createClient();
  const { user, profile } = useAuth();
  const [upcomingMeetings, setUpcomingMeetings] = useState<Schedule[]>([]);
  const [pastMeetings, setPastMeetings] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const res = await fetch('/api/meetings');
      if (res.ok) {
        const data = await res.json();
        setUpcomingMeetings(data.upcoming || []);
        setPastMeetings(data.past || []);
        setIsLoading(false);
        return;
      }
    } catch (e) {
      console.log('API fetch failed, trying direct');
    }

    // API 실패시 직접 호출
    const now = new Date().toISOString();

    const { data: upcoming } = await supabase
      .from('schedules')
      .select('*')
      .eq('status', 'confirmed')
      .gte('meeting_date', now)
      .order('meeting_date', { ascending: true });

    const { data: past } = await supabase
      .from('schedules')
      .select('*')
      .eq('status', 'confirmed')
      .lt('meeting_date', now)
      .order('meeting_date', { ascending: false })
      .limit(20);

    const loadDetails = async (schedules: any[]) => {
      return Promise.all(
        schedules.map(async (schedule) => {
          let presenter = null;
          let selected_book = null;

          if (schedule.presenter_id) {
            const { data: p } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', schedule.presenter_id)
              .single();
            presenter = p;
          }

          if (schedule.selected_book_id) {
            const { data: b } = await supabase
              .from('books')
              .select('title, author, cover_url')
              .eq('id', schedule.selected_book_id)
              .single();
            selected_book = b;
          }

          return { ...schedule, presenter, selected_book, ratings: [] };
        })
      );
    };

    if (upcoming) {
      setUpcomingMeetings(await loadDetails(upcoming));
    }
    if (past) {
      setPastMeetings(await loadDetails(past));
    }

    setIsLoading(false);
  };

  const renderStars = (rating: number) => {
    return (
      <span className="text-yellow-500">
        {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
      </span>
    );
  };

  const MeetingCard = ({ meeting, isPast }: { meeting: Schedule; isPast?: boolean }) => {
    const meetingDate = new Date(meeting.meeting_date);
    const isToday = format(meetingDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

    // 평균 평점 계산
    const avgRating = meeting.ratings && meeting.ratings.length > 0
      ? (meeting.ratings.reduce((sum, r) => sum + r.rating, 0) / meeting.ratings.length).toFixed(1)
      : null;

    return (
      <Link href={`/meetings/${meeting.id}`}>
        <Card className={cn(
          "hover:border-blue-300 transition-all hover:shadow-md cursor-pointer",
          isToday && "border-blue-500 bg-blue-50"
        )}>
          <CardContent className="p-4">
            <div className="flex gap-4">
              {/* 책 이미지 */}
              <div className="flex-shrink-0 w-16 h-24 rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 shadow-sm">
                {meeting.selected_book?.cover_url ? (
                  <img
                    src={meeting.selected_book.cover_url}
                    alt={meeting.selected_book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600">
                    <Book className="w-6 h-6 text-white" />
                  </div>
                )}
              </div>

              {/* 모임 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className={cn(
                    "text-sm font-medium",
                    isToday ? "text-blue-600" : "text-gray-600"
                  )}>
                    {format(meetingDate, 'M월 d일 (EEEE)', { locale: ko })}
                    {isToday && <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">오늘</span>}
                  </span>
                </div>

                {meeting.selected_book ? (
                  <h3 className="font-semibold text-gray-900 truncate">
                    {meeting.selected_book.title}
                  </h3>
                ) : (
                  <h3 className="font-semibold text-gray-500">책 미선정</h3>
                )}

                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-gray-500">
                  {meeting.presenter && (
                    <span>발제자: {meeting.presenter.name}</span>
                  )}
                  {meeting.meeting_time && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {meeting.meeting_time}
                    </span>
                  )}
                  {meeting.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {meeting.location}
                    </span>
                  )}
                </div>

                {/* 평점 (지난 모임) */}
                {isPast && meeting.ratings && meeting.ratings.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {/* 최종 평점 */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">최종 평점:</span>
                      <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                      <span className="font-bold text-lg text-yellow-600">{avgRating}</span>
                      <span className="text-xs text-gray-400">({meeting.ratings.length}명 평가)</span>
                    </div>
                    {/* 개별 평점 */}
                    <div className="flex flex-wrap gap-2">
                      {meeting.ratings.map((r, idx) => (
                        <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded-full flex items-center gap-1">
                          {r.name}: {renderStars(r.rating)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 공개 상태 */}
                <div className="mt-2">
                  {meeting.is_revealed ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      공개됨
                    </span>
                  ) : isPast ? (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      미공개
                    </span>
                  ) : (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                      준비중
                    </span>
                  )}
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-gray-400 self-center" />
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  };

  const MeetingTable = ({ meetings, isPast }: { meetings: Schedule[]; isPast?: boolean }) => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left p-3 text-sm font-medium text-gray-700">날짜</th>
              <th className="text-left p-3 text-sm font-medium text-gray-700">시간</th>
              <th className="text-left p-3 text-sm font-medium text-gray-700">책</th>
              <th className="text-left p-3 text-sm font-medium text-gray-700">발제자</th>
              <th className="text-left p-3 text-sm font-medium text-gray-700">장소</th>
              {isPast && <th className="text-left p-3 text-sm font-medium text-gray-700">평점</th>}
              <th className="text-left p-3 text-sm font-medium text-gray-700">상태</th>
            </tr>
          </thead>
          <tbody>
            {meetings.map((meeting) => {
              const meetingDate = new Date(meeting.meeting_date);
              const isToday = format(meetingDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
              const avgRating = meeting.ratings && meeting.ratings.length > 0
                ? (meeting.ratings.reduce((sum, r) => sum + r.rating, 0) / meeting.ratings.length).toFixed(1)
                : null;

              return (
                <tr
                  key={meeting.id}
                  className={cn(
                    "border-b hover:bg-gray-50 cursor-pointer",
                    isToday && "bg-blue-50"
                  )}
                  onClick={() => window.location.href = `/meetings/${meeting.id}`}
                >
                  <td className="p-3 text-sm">
                    {format(meetingDate, 'yyyy.MM.dd (EEE)', { locale: ko })}
                    {isToday && <span className="ml-1 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">오늘</span>}
                  </td>
                  <td className="p-3 text-sm text-gray-600">{meeting.meeting_time || '-'}</td>
                  <td className="p-3 text-sm font-medium">{meeting.selected_book?.title || '미선정'}</td>
                  <td className="p-3 text-sm text-gray-600">{meeting.presenter?.name || '-'}</td>
                  <td className="p-3 text-sm text-gray-600">{meeting.location || '-'}</td>
                  {isPast && (
                    <td className="p-3 text-sm">
                      {avgRating ? (
                        <span className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-bold text-yellow-600">{avgRating}</span>
                          <span className="text-gray-400 text-xs">({meeting.ratings?.length}명)</span>
                        </span>
                      ) : '-'}
                    </td>
                  )}
                  <td className="p-3">
                    {meeting.is_revealed ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">공개</span>
                    ) : isPast ? (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">미공개</span>
                    ) : (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">준비중</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">모임 목록</h1>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-32 animate-pulse bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">모임 목록</h1>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('card')}
            className={cn(
              "p-2 rounded-md transition-colors",
              viewMode === 'card' ? "bg-white shadow-sm" : "hover:bg-gray-200"
            )}
            title="카드 보기"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              "p-2 rounded-md transition-colors",
              viewMode === 'table' ? "bg-white shadow-sm" : "hover:bg-gray-200"
            )}
            title="표 보기"
          >
            <Table className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 다가올 모임 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          다가올 모임
        </h2>

        {upcomingMeetings.length > 0 ? (
          viewMode === 'card' ? (
            <div className="space-y-3">
              {upcomingMeetings.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))}
            </div>
          ) : (
            <Card>
              <MeetingTable meetings={upcomingMeetings} />
            </Card>
          )
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              예정된 모임이 없습니다
            </CardContent>
          </Card>
        )}
      </section>

      {/* 지난 모임 */}
      {pastMeetings.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Book className="w-5 h-5 text-gray-400" />
            지난 모임
          </h2>

          {viewMode === 'card' ? (
            <div className="space-y-3">
              {pastMeetings.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} isPast />
              ))}
            </div>
          ) : (
            <Card>
              <MeetingTable meetings={pastMeetings} isPast />
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
