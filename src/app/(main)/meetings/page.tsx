'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Book, Users, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Schedule {
  id: string;
  title: string;
  meeting_date: string;
  presenter_id: string | null;
  selected_book_id: string | null;
  status: string;
  is_revealed: boolean;
  presenter?: { name: string };
  selected_book?: { title: string; author: string; cover_url?: string };
}

export default function MeetingsPage() {
  const supabase = createClient();
  const { user, profile } = useAuth();
  const [upcomingMeetings, setUpcomingMeetings] = useState<Schedule[]>([]);
  const [pastMeetings, setPastMeetings] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    const now = new Date().toISOString();

    // 다가올 모임
    const { data: upcoming } = await supabase
      .from('schedules')
      .select('*')
      .eq('status', 'confirmed')
      .gte('meeting_date', now)
      .order('meeting_date', { ascending: true });

    // 지난 모임
    const { data: past } = await supabase
      .from('schedules')
      .select('*')
      .eq('status', 'confirmed')
      .lt('meeting_date', now)
      .order('meeting_date', { ascending: false })
      .limit(10);

    // 상세 정보 로드
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

          return { ...schedule, presenter, selected_book };
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

  const MeetingCard = ({ meeting, isPast }: { meeting: Schedule; isPast?: boolean }) => {
    const meetingDate = new Date(meeting.meeting_date);
    const isToday = format(meetingDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

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

                {meeting.presenter && (
                  <p className="text-sm text-gray-500 mt-1">
                    발제자: {meeting.presenter.name}
                  </p>
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
      </div>

      {/* 다가올 모임 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          다가올 모임
        </h2>

        {upcomingMeetings.length > 0 ? (
          <div className="space-y-3">
            {upcomingMeetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
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

          <div className="space-y-3">
            {pastMeetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} isPast />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
