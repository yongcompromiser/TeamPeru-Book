'use client';

import { useState, useEffect, use } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar, MapPin, User, Book, Users, Check, Loader2 } from 'lucide-react';

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time: string | null;
  location: string | null;
  presenter_name: string | null;
  book: { title: string; author: string; cover_url: string | null } | null;
  rsvp_count: number;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function InvitePage({ params }: PageProps) {
  const { id } = use(params);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/invite/${id}`);
        if (res.ok) {
          const data = await res.json();
          setMeeting(data.meeting);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      }
      setIsLoading(false);
    })();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (notFound || !meeting) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex flex-col items-center justify-center px-6 text-center">
        <Book className="w-12 h-12 text-gray-300 mb-4" />
        <h1 className="text-lg font-bold text-gray-700">초대장을 찾을 수 없어요</h1>
        <p className="text-sm text-gray-500 mt-1">링크가 만료되었거나 아직 공개되지 않은 모임입니다.</p>
      </div>
    );
  }

  const meetingDate = new Date(meeting.meeting_date);

  return (
    <div className="min-h-screen bg-[#faf8f5] py-10 px-4">
      <div className="max-w-md mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <p className="text-sm font-medium text-amber-700">팀 페루 독서토론</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">모임 초대장 📖</h1>
          <p className="text-sm text-gray-500 mt-1">게스트로 함께하실 분을 초대합니다</p>
        </div>

        {/* 모임 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-5">
          <div className="flex gap-4 p-5">
            <div className="flex-shrink-0 w-20 h-28 rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 shadow">
              {meeting.book?.cover_url ? (
                <img src={meeting.book.cover_url} alt={meeting.book.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600">
                  <Book className="w-7 h-7 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {meeting.book ? (
                <>
                  <h2 className="text-lg font-bold text-gray-900 leading-snug">{meeting.book.title}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{meeting.book.author}</p>
                </>
              ) : (
                <h2 className="text-lg font-bold text-gray-500">책 미정</h2>
              )}
              {meeting.presenter_name && (
                <p className="text-xs text-gray-600 mt-2 inline-flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> 발제 {meeting.presenter_name}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 px-5 py-4 space-y-2.5 text-sm text-gray-700">
            <p className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              {format(meetingDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
              {meeting.meeting_time && <span className="text-gray-500">· {meeting.meeting_time}</span>}
            </p>
            {meeting.location && (
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-600" />
                {meeting.location}
              </p>
            )}
            <p className="flex items-center gap-2 text-gray-500">
              <Users className="w-4 h-4 text-amber-600" />
              현재 {meeting.rsvp_count}명 참석 신청
            </p>
          </div>
        </div>

        {/* 참여는 카카오로만 받는다.
            익명 신청은 누가 오는지 확인할 길이 없고 장난 신청도 막기 어려워 없앴다. */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
          <h3 className="font-bold text-gray-900">참석하시겠어요?</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            카카오로 참여하면 참석 신청과 입장이 한 번에 끝나요.
          </p>

          <a
            href={`/api/auth/kakao/start?mode=guest&next=/meetings/${id}`}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] px-4 text-base font-semibold text-[#191600] transition-opacity hover:opacity-90"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path fill="#191600" d="M12 3C6.477 3 2 6.477 2 10.8c0 2.77 1.86 5.2 4.66 6.58-.2.72-.74 2.66-.85 3.07-.13.51.19.5.4.37.16-.11 2.6-1.77 3.66-2.49.69.1 1.4.16 2.13.16 5.523 0 10-3.477 10-7.69C24 6.477 17.523 3 12 3Z" />
            </svg>
            카카오로 게스트 참여하기
          </a>

          <ul className="text-xs text-gray-500 mt-4 space-y-1.5 text-left">
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
              승인을 기다릴 필요 없이 바로 입장돼요
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
              참석 명단에 자동으로 올라가요
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
              책·회의록을 둘러보고 한줄평과 평점을 남길 수 있어요
            </li>
          </ul>

          <p className="text-[11px] text-gray-400 mt-4">
            카카오 닉네임만 받아요. 이메일이나 전화번호는 받지 않습니다.
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          팀 페루 독서토론 · 함께 읽고 나누는 즐거움
        </p>
      </div>
    </div>
  );
}
