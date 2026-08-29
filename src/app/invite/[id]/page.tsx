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

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/invite/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contact, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || '신청에 실패했습니다. 다시 시도해주세요.');
      }
    } catch {
      setError('신청 중 오류가 발생했습니다.');
    }
    setIsSubmitting(false);
  };

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

        {/* RSVP 폼 / 완료 */}
        {submitted ? (
          <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-bold text-gray-900">참석 신청 완료!</h3>
            <p className="text-sm text-gray-500 mt-1">
              신청해주셔서 감사합니다. 모임 전에 안내드릴게요. 편하게 오세요 😊
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-3">참석 신청하기</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">이름 *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="어떻게 불러드리면 될까요?"
                  maxLength={40}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">연락처 (선택)</label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="카톡 ID·전화번호 등 (안내용)"
                  maxLength={100}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">한마디 (선택)</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="궁금한 점이나 하고 싶은 말이 있다면?"
                  maxLength={300}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-h-20"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full h-11 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : '참석 신청하기'}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          팀 페루 독서토론 · 함께 읽고 나누는 즐거움
        </p>
      </div>
    </div>
  );
}
