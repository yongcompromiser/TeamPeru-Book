'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Check, Users, Calendar, Book, Vote } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Vote {
  vote_date: string;
  user_id: string;
  profile?: {
    name: string;
  };
}

interface VoteCount {
  date: string;
  count: number;
  users: string[];
  hasMyVote: boolean;
}

interface Schedule {
  id: string;
  title: string;
  meeting_date: string;
  presenter_id: string | null;
  selected_book_id: string | null;
  status: string;
  presenter?: { name: string };
  selected_book?: { title: string; author: string };
}

interface Profile {
  id: string;
  name: string;
}

interface BookType {
  id: string;
  title: string;
  author: string;
  cover_url?: string;
  status: string;
}

interface BookCandidate {
  id: string;
  book_id: string;
  book: BookType;
}

interface BookVote {
  book_id: string;
  user_id: string;
  voter_name?: string;
}

export default function SchedulePage() {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [votes, setVotes] = useState<Vote[]>([]);
  const [voteCounts, setVoteCounts] = useState<Map<string, VoteCount>>(new Map());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [selectedPresenter, setSelectedPresenter] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Book selection states
  const [availableBooks, setAvailableBooks] = useState<BookType[]>([]);
  const [bookCandidates, setBookCandidates] = useState<BookCandidate[]>([]);
  const [bookVotes, setBookVotes] = useState<BookVote[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    fetchVotes();
    fetchSchedules();
    fetchMembers();
    fetchAvailableBooks();
  }, [currentDate, user]);

  const fetchVotes = async () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);

    const { data } = await supabase
      .from('schedule_votes')
      .select('*, profile:profiles(name)')
      .gte('vote_date', format(start, 'yyyy-MM-dd'))
      .lte('vote_date', format(end, 'yyyy-MM-dd'));

    const voteData = (data || []) as Vote[];
    setVotes(voteData);

    const counts = new Map<string, VoteCount>();
    voteData.forEach((vote) => {
      const dateKey = vote.vote_date;
      const existing = counts.get(dateKey) || {
        date: dateKey,
        count: 0,
        users: [],
        hasMyVote: false,
      };
      existing.count++;
      existing.users.push(vote.profile?.name || '');
      if (vote.user_id === user?.id) {
        existing.hasMyVote = true;
      }
      counts.set(dateKey, existing);
    });
    setVoteCounts(counts);
  };

  const fetchSchedules = async () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);

    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .gte('meeting_date', start.toISOString())
      .lte('meeting_date', end.toISOString());

    console.log('Schedules loaded:', data, 'Error:', error?.message);

    if (data) {
      // presenter와 book 정보 별도로 로드
      const schedulesWithDetails = await Promise.all(
        data.map(async (schedule) => {
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
              .select('title, author')
              .eq('id', schedule.selected_book_id)
              .single();
            selected_book = b;
          }

          return { ...schedule, presenter, selected_book };
        })
      );

      setSchedules(schedulesWithDetails);
    } else {
      setSchedules([]);
    }
  };

  const fetchMembers = async () => {
    const { data } = await supabase.from('profiles').select('id, name');
    setMembers(data || []);
  };

  const fetchAvailableBooks = async () => {
    const { data } = await supabase
      .from('books')
      .select('*')
      .eq('status', 'waiting');
    setAvailableBooks(data || []);
  };

  const fetchBookCandidates = async (scheduleId: string) => {
    const { data } = await supabase
      .from('schedule_book_candidates')
      .select('*, book:books(*)')
      .eq('schedule_id', scheduleId);
    setBookCandidates(data || []);

    const { data: votes } = await supabase
      .from('book_votes')
      .select('book_id, user_id')
      .eq('schedule_id', scheduleId);

    // 투표자 이름 가져오기
    if (votes && votes.length > 0) {
      const userIds = [...new Set(votes.map(v => v.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
      const votesWithNames = votes.map(v => ({
        ...v,
        voter_name: profileMap.get(v.user_id) || '알 수 없음'
      }));
      setBookVotes(votesWithNames);
    } else {
      setBookVotes([]);
    }
  };

  const handleDateClick = async (day: Date) => {
    if (!user) return;

    const dateKey = format(day, 'yyyy-MM-dd');

    // Check if this date already has a confirmed schedule
    const hasSchedule = schedules.some(s =>
      format(new Date(s.meeting_date), 'yyyy-MM-dd') === dateKey
    );

    if (hasSchedule) {
      // Show schedule details instead of voting
      const schedule = schedules.find(s =>
        format(new Date(s.meeting_date), 'yyyy-MM-dd') === dateKey
      );
      if (schedule) {
        setSelectedSchedule(schedule);
        setSelectedDate(day);
        await fetchBookCandidates(schedule.id);
      }
      return;
    }

    const voteCount = voteCounts.get(dateKey);
    setIsLoading(true);

    if (voteCount?.hasMyVote) {
      await supabase
        .from('schedule_votes')
        .delete()
        .eq('user_id', user.id)
        .eq('vote_date', dateKey);
    } else {
      await supabase
        .from('schedule_votes')
        .insert({
          user_id: user.id,
          vote_date: dateKey,
        });
    }

    await fetchVotes();
    setIsLoading(false);
    setSelectedDate(day);
    setSelectedSchedule(null);
  };

  const handleConfirmSchedule = async () => {
    if (!selectedDate || !isAdmin || !selectedPresenter) return;

    const dateKey = format(selectedDate, 'yyyy-MM-dd');

    // Check for duplicate
    const existingSchedule = schedules.find(s =>
      format(new Date(s.meeting_date), 'yyyy-MM-dd') === dateKey
    );

    if (existingSchedule) {
      alert('이미 확정된 일정입니다.');
      return;
    }

    const { error } = await supabase.from('schedules').insert({
      title: `${format(selectedDate, 'M월 d일')} 모임`,
      meeting_date: new Date(dateKey).toISOString(),
      presenter_id: selectedPresenter,
      created_by: user?.id,
      status: 'confirmed',
    });

    if (error) {
      alert('일정 생성에 실패했습니다.');
      return;
    }

    // Clear votes for this date
    await supabase
      .from('schedule_votes')
      .delete()
      .eq('vote_date', dateKey);

    alert('일정이 확정되었습니다!');
    setShowConfirmModal(false);
    setSelectedPresenter('');
    await fetchVotes();
    await fetchSchedules();
  };

  const handleAddBookCandidate = async (bookId: string) => {
    if (!selectedSchedule) return;

    const { error } = await supabase
      .from('schedule_book_candidates')
      .insert({
        schedule_id: selectedSchedule.id,
        book_id: bookId,
      });

    if (!error) {
      await fetchBookCandidates(selectedSchedule.id);
    }
  };

  const handleRemoveBookCandidate = async (candidateId: string) => {
    await supabase
      .from('schedule_book_candidates')
      .delete()
      .eq('id', candidateId);

    if (selectedSchedule) {
      await fetchBookCandidates(selectedSchedule.id);
    }
  };

  const handleBookVote = async (bookId: string) => {
    if (!user || !selectedSchedule) return;

    const existingVote = bookVotes.find(
      v => v.book_id === bookId && v.user_id === user.id
    );

    if (existingVote) {
      await supabase
        .from('book_votes')
        .delete()
        .eq('schedule_id', selectedSchedule.id)
        .eq('book_id', bookId)
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('book_votes')
        .insert({
          schedule_id: selectedSchedule.id,
          book_id: bookId,
          user_id: user.id,
        });
    }

    await fetchBookCandidates(selectedSchedule.id);
  };

  const handleSelectFinalBook = async (bookId: string) => {
    if (!selectedSchedule) return;

    const { error } = await supabase
      .from('schedules')
      .update({ selected_book_id: bookId })
      .eq('id', selectedSchedule.id);

    if (!error) {
      // Update book status
      await supabase
        .from('books')
        .update({ status: 'selected' })
        .eq('id', bookId);

      alert('책이 선정되었습니다!');
      await fetchSchedules();
      await fetchAvailableBooks();
    }
  };

  const handleCancelSchedule = async () => {
    if (!selectedSchedule || !isAdmin) return;

    if (!confirm('정말 이 일정을 취소하시겠습니까?')) return;

    // 관련 book_votes 삭제
    await supabase
      .from('book_votes')
      .delete()
      .eq('schedule_id', selectedSchedule.id);

    // 관련 schedule_book_candidates 삭제
    await supabase
      .from('schedule_book_candidates')
      .delete()
      .eq('schedule_id', selectedSchedule.id);

    // schedule 삭제
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', selectedSchedule.id);

    if (!error) {
      alert('일정이 취소되었습니다.');
      setSelectedSchedule(null);
      setSelectedDate(null);
      await fetchSchedules();
    } else {
      alert('일정 취소에 실패했습니다.');
    }
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const firstDayOfMonth = startOfMonth(currentDate);
  const startPadding = firstDayOfMonth.getDay();

  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selectedVoteCount = selectedDateKey ? voteCounts.get(selectedDateKey) : null;

  const canManageBooks = selectedSchedule && (
    isAdmin || selectedSchedule.presenter_id === user?.id
  );

  const getBookVoteCount = (bookId: string) => {
    return bookVotes.filter(v => v.book_id === bookId).length;
  };

  const hasVotedForBook = (bookId: string) => {
    return bookVotes.some(v => v.book_id === bookId && v.user_id === user?.id);
  };

  const getVotersForBook = (bookId: string) => {
    return bookVotes
      .filter(v => v.book_id === bookId)
      .map(v => v.voter_name || '알 수 없음');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">모임 일정</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{format(currentDate, 'yyyy년 M월', { locale: ko })}</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}

              {Array.from({ length: startPadding }).map((_, index) => (
                <div key={`pad-${index}`} className="aspect-square" />
              ))}

              {days.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const voteCount = voteCounts.get(dateKey);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());
                const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
                const hasMyVote = voteCount?.hasMyVote;

                const confirmedSchedule = schedules.find(s =>
                  format(new Date(s.meeting_date), 'yyyy-MM-dd') === dateKey
                );

                return (
                  <button
                    key={day.toString()}
                    onClick={() => !isPast && handleDateClick(day)}
                    disabled={isPast || isLoading}
                    className={cn(
                      'aspect-square p-1 rounded-lg text-sm transition-all relative flex flex-col items-center justify-center',
                      isPast && 'text-gray-300 cursor-not-allowed',
                      !isPast && 'hover:bg-gray-100',
                      isSelected && 'ring-2 ring-blue-500',
                      hasMyVote && !confirmedSchedule && 'bg-blue-100 text-blue-700',
                      confirmedSchedule && 'bg-green-100 text-green-700',
                      isToday && !hasMyVote && !confirmedSchedule && 'font-bold text-blue-600'
                    )}
                  >
                    <span>{format(day, 'd')}</span>
                    {confirmedSchedule ? (
                      <span className="text-lg">📅</span>
                    ) : voteCount && voteCount.count > 0 ? (
                      <span className={cn(
                        'text-xs font-bold mt-0.5 px-1.5 py-0.5 rounded-full',
                        hasMyVote ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                      )}>
                        {voteCount.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-100 rounded" />
                <span>내가 투표한 날</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 rounded flex items-center justify-center">📅</div>
                <span>확정된 일정</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedDate
                ? format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })
                : '날짜를 선택하세요'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedSchedule ? (
              // Confirmed schedule view
              <div className="space-y-4">
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="font-medium text-green-800">📅 확정된 일정</p>
                  {selectedSchedule.presenter && (
                    <p className="text-sm text-green-700 mt-1">
                      발제자: {selectedSchedule.presenter.name}
                    </p>
                  )}
                  {selectedSchedule.selected_book && (
                    <p className="text-sm text-green-700 mt-1">
                      선정 도서: {selectedSchedule.selected_book.title}
                    </p>
                  )}
                  {isAdmin && (
                    <button
                      onClick={handleCancelSchedule}
                      className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
                    >
                      일정 취소
                    </button>
                  )}
                </div>

                {/* Book Candidates */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Book className="w-4 h-4" />
                    후보 도서
                  </h3>

                  {bookCandidates.length > 0 ? (
                    <div className="space-y-3">
                      {bookCandidates.map((candidate) => (
                        <div
                          key={candidate.id}
                          className={cn(
                            "p-3 border-2 rounded-xl transition-all hover:shadow-md",
                            selectedSchedule.selected_book_id === candidate.book_id
                              ? "border-green-500 bg-green-50"
                              : "border-gray-200 hover:border-blue-300"
                          )}
                        >
                          <div className="flex gap-3">
                            {/* 책 이미지 */}
                            <div className="flex-shrink-0 w-14 h-20 rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 shadow-sm">
                              {candidate.book.cover_url ? (
                                <img
                                  src={candidate.book.cover_url}
                                  alt={candidate.book.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600">
                                  <Book className="w-6 h-6 text-white" />
                                </div>
                              )}
                            </div>

                            {/* 책 정보 */}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-gray-900 line-clamp-1">{candidate.book.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{candidate.book.author}</p>

                              {/* 투표 버튼 */}
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  onClick={() => handleBookVote(candidate.book_id)}
                                  className={cn(
                                    "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                                    hasVotedForBook(candidate.book_id)
                                      ? "bg-blue-500 text-white shadow-sm"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  )}
                                >
                                  {hasVotedForBook(candidate.book_id) ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      투표함
                                    </>
                                  ) : (
                                    <>
                                      <Vote className="w-3 h-3" />
                                      투표
                                    </>
                                  )}
                                  <span className={cn(
                                    "ml-1 px-1.5 rounded",
                                    hasVotedForBook(candidate.book_id) ? "bg-white/20" : "bg-gray-200"
                                  )}>
                                    {getBookVoteCount(candidate.book_id)}
                                  </span>
                                </button>
                                {canManageBooks && !selectedSchedule.selected_book_id && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSelectFinalBook(candidate.book_id)}
                                    className="text-xs h-7"
                                  >
                                    선정
                                  </Button>
                                )}
                              </div>

                              {/* 투표자 목록 */}
                              {getBookVoteCount(candidate.book_id) > 0 && (
                                <p className="mt-1.5 text-xs text-gray-400">
                                  {getVotersForBook(candidate.book_id).join(', ')}
                                </p>
                              )}
                            </div>
                          </div>

                          {canManageBooks && (
                            <button
                              onClick={() => handleRemoveBookCandidate(candidate.id)}
                              className="text-xs text-red-400 mt-2 hover:text-red-600 hover:underline"
                            >
                              후보에서 제거
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">후보 도서가 없습니다</p>
                  )}
                </div>

                {/* Add Book (Admin/Presenter only) */}
                {canManageBooks && !selectedSchedule.selected_book_id && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">도서 추가</h3>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {availableBooks
                        .filter(book => !bookCandidates.some(c => c.book_id === book.id))
                        .map((book) => (
                          <button
                            key={book.id}
                            onClick={() => handleAddBookCandidate(book.id)}
                            className="w-full flex items-center gap-3 p-2 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all group"
                          >
                            {/* 책 이미지 */}
                            <div className="flex-shrink-0 w-10 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 shadow-sm group-hover:shadow-md transition-shadow">
                              {book.cover_url ? (
                                <img
                                  src={book.cover_url}
                                  alt={book.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-300 to-gray-400">
                                  <Book className="w-4 h-4 text-white" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 text-left min-w-0">
                              <p className="font-medium text-sm text-gray-900 line-clamp-1 group-hover:text-blue-600">{book.title}</p>
                              <p className="text-xs text-gray-500">{book.author}</p>
                            </div>

                            <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-xs font-medium">+ 추가</span>
                            </div>
                          </button>
                        ))}
                      {availableBooks.filter(book => !bookCandidates.some(c => c.book_id === book.id)).length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">추가할 수 있는 책이 없습니다</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : selectedDate && selectedVoteCount ? (
              // Voting view
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span>{selectedVoteCount.count}명 투표</span>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">투표한 멤버:</p>
                  <ul className="space-y-1">
                    {selectedVoteCount.users.map((name, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>

                {isAdmin && selectedVoteCount.count > 0 && (
                  <Button onClick={() => setShowConfirmModal(true)} className="w-full mt-4">
                    <Calendar className="w-4 h-4 mr-2" />
                    이 날짜로 확정
                  </Button>
                )}
              </div>
            ) : selectedDate ? (
              <p className="text-gray-500">아직 투표가 없습니다</p>
            ) : (
              <p className="text-gray-500">달력에서 날짜를 클릭하여 투표하세요</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">일정 확정</h2>
            <p className="text-gray-600 mb-4">
              {selectedDate && format(selectedDate, 'yyyy년 M월 d일', { locale: ko })}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                발제자 선택
              </label>
              <select
                value={selectedPresenter}
                onChange={(e) => setSelectedPresenter(e.target.value)}
                className="w-full border rounded-lg p-2"
              >
                <option value="">발제자를 선택하세요</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleConfirmSchedule}
                disabled={!selectedPresenter}
                className="flex-1"
              >
                확정
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirmModal(false);
                  setSelectedPresenter('');
                }}
                className="flex-1"
              >
                취소
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-gray-600">
            <strong>사용 방법:</strong> 참석 가능한 날짜를 클릭하여 투표하세요.
            확정된 일정(📅)을 클릭하면 후보 도서를 보고 투표할 수 있습니다.
            {isAdmin && ' 관리자는 투표가 많은 날짜를 선택하여 일정을 확정할 수 있습니다.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
