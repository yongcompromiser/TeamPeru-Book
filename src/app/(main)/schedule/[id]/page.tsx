'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ArrowLeft, Calendar, MapPin, BookOpen, Users, Check, X, HelpCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Schedule, Attendance, AttendanceStatus } from '@/types';

interface ScheduleDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ScheduleDetailPage({ params }: ScheduleDetailPageProps) {
  const { id } = use(params);
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [myAttendance, setMyAttendance] = useState<AttendanceStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id, user]);

  const fetchData = async () => {
    const { data: scheduleData } = await supabase
      .from('schedules')
      .select('*, book:books(*)')
      .eq('id', id)
      .single();

    if (scheduleData) {
      setSchedule(scheduleData as Schedule);
    }

    const { data: attendanceData } = await supabase
      .from('attendances')
      .select('*, profile:profiles(*)')
      .eq('schedule_id', id);

    if (attendanceData) {
      setAttendances(attendanceData as Attendance[]);
      const mine = attendanceData.find((a) => a.user_id === user?.id);
      if (mine) {
        setMyAttendance(mine.status as AttendanceStatus);
      }
    }

    setIsLoading(false);
  };

  const handleAttendance = async (status: AttendanceStatus) => {
    if (!user) return;

    const existingAttendance = attendances.find((a) => a.user_id === user.id);

    if (existingAttendance) {
      await supabase
        .from('attendances')
        .update({ status })
        .eq('id', existingAttendance.id);
    } else {
      await supabase.from('attendances').insert({
        schedule_id: id,
        user_id: user.id,
        status,
      });
    }

    setMyAttendance(status);
    fetchData();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">일정을 찾을 수 없습니다</p>
        <Link href="/schedule" className="text-blue-600 hover:underline mt-2 inline-block">
          일정 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const attendingCount = attendances.filter((a) => a.status === 'attending').length;
  const notAttendingCount = attendances.filter((a) => a.status === 'not_attending').length;
  const maybeCount = attendances.filter((a) => a.status === 'maybe').length;

  return (
    <div className="space-y-6">
      <Link
        href="/schedule"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        일정 목록으로
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{schedule.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-gray-600">
                <Calendar className="w-5 h-5" />
                <span>
                  {format(parseISO(schedule.meeting_date), 'yyyy년 M월 d일 (EEEE) a h:mm', {
                    locale: ko,
                  })}
                </span>
              </div>

              {schedule.location && (
                <div className="flex items-center gap-3 text-gray-600">
                  <MapPin className="w-5 h-5" />
                  <span>{schedule.location}</span>
                </div>
              )}

              {schedule.book && (
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-gray-600" />
                  <Link
                    href={`/books/${schedule.book.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {schedule.book.title} - {schedule.book.author}
                  </Link>
                </div>
              )}

              {schedule.description && (
                <div className="pt-4 border-t">
                  <p className="text-gray-700 whitespace-pre-wrap">{schedule.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Attendance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">참석 여부</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant={myAttendance === 'attending' ? 'primary' : 'outline'}
                  onClick={() => handleAttendance('attending')}
                  className={cn(
                    myAttendance === 'attending' && 'bg-green-600 hover:bg-green-700'
                  )}
                >
                  <Check className="w-4 h-4 mr-2" />
                  참석
                </Button>
                <Button
                  variant={myAttendance === 'not_attending' ? 'primary' : 'outline'}
                  onClick={() => handleAttendance('not_attending')}
                  className={cn(
                    myAttendance === 'not_attending' && 'bg-red-600 hover:bg-red-700'
                  )}
                >
                  <X className="w-4 h-4 mr-2" />
                  불참
                </Button>
                <Button
                  variant={myAttendance === 'maybe' ? 'primary' : 'outline'}
                  onClick={() => handleAttendance('maybe')}
                  className={cn(
                    myAttendance === 'maybe' && 'bg-yellow-600 hover:bg-yellow-700'
                  )}
                >
                  <HelpCircle className="w-4 h-4 mr-2" />
                  미정
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attendance List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              참석 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4 text-sm">
              <span className="text-green-600">참석 {attendingCount}</span>
              <span className="text-red-600">불참 {notAttendingCount}</span>
              <span className="text-yellow-600">미정 {maybeCount}</span>
            </div>

            {attendances.length > 0 ? (
              <ul className="space-y-3">
                {attendances.map((attendance) => (
                  <li key={attendance.id} className="flex items-center gap-3">
                    <Avatar
                      src={attendance.profile?.avatar_url}
                      name={attendance.profile?.name || ''}
                      size="sm"
                    />
                    <span className="flex-1 text-sm text-gray-900">
                      {attendance.profile?.name}
                    </span>
                    <Badge
                      variant={
                        attendance.status === 'attending'
                          ? 'success'
                          : attendance.status === 'not_attending'
                          ? 'danger'
                          : 'warning'
                      }
                    >
                      {attendance.status === 'attending'
                        ? '참석'
                        : attendance.status === 'not_attending'
                        ? '불참'
                        : '미정'}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-center py-4">
                아직 참석 여부를 등록한 사람이 없습니다
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
