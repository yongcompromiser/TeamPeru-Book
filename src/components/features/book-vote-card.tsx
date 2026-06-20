'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, User, ThumbsUp, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';

interface BookVoteCardProps {
  scheduleId: string | null;
  featuredBook: any;
  featuredPresenter: any;
}

interface Candidate {
  id: string;
  book: {
    id: string;
    title: string;
    author: string;
    cover_url?: string;
  };
}

interface Vote {
  book_id: string;
  user_id: string;
  voter_name: string;
}

export function BookVoteCard({ scheduleId, featuredBook, featuredPresenter }: BookVoteCardProps) {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [isVoting, setIsVoting] = useState<string | null>(null);

  useEffect(() => {
    if (scheduleId && !featuredBook) {
      fetchCandidates();
    }
  }, [scheduleId, featuredBook]);

  const fetchCandidates = async () => {
    try {
      const res = await fetch(`/api/schedule/books?scheduleId=${scheduleId}`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates || []);
        setVotes(data.votes || []);
      }
    } catch {}
  };

  const handleVote = async (bookId: string) => {
    if (!user || !scheduleId) return;
    setIsVoting(bookId);

    const myVote = votes.find(v => v.book_id === bookId && v.user_id === user.id);
    const action = myVote ? 'unvote' : 'vote';

    try {
      await fetch('/api/schedule/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, scheduleId, bookId }),
      });
      await fetchCandidates();
    } catch {}

    setIsVoting(null);
  };

  const getVotesForBook = (bookId: string) => votes.filter(v => v.book_id === bookId);
  const hasVoted = (bookId: string) => votes.some(v => v.book_id === bookId && v.user_id === user?.id);

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4">
        <div className="flex items-center gap-2 text-white">
          <BookOpen className="w-5 h-5" />
          <span className="font-medium">이번 책</span>
        </div>
      </div>
      <CardContent className="pt-6">
        {featuredBook ? (
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              {featuredBook.cover_url ? (
                <img
                  src={featuredBook.cover_url}
                  alt={featuredBook.title}
                  className="w-32 h-44 object-cover rounded-lg shadow-md"
                />
              ) : (
                <div className="w-32 h-44 bg-gray-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 leading-tight">
                {featuredBook.title}
              </h2>
              <p className="text-gray-600 mt-1">{featuredBook.author}</p>
              {featuredPresenter && (
                <div className="flex items-center gap-1 text-sm text-emerald-600 mt-2">
                  <User className="w-4 h-4" />
                  <span className="inline-flex items-center gap-1.5">발제자: <Avatar src={featuredPresenter.avatar_url} name={featuredPresenter.name} size="xs" />{featuredPresenter.name}</span>
                </div>
              )}
              {featuredBook.description && (
                <p className="text-sm text-gray-600 mt-3 line-clamp-3">
                  {featuredBook.description}
                </p>
              )}
              <Link
                href={`/books/${featuredBook.id}`}
                className="inline-block mt-3 text-emerald-600 hover:underline text-sm"
              >
                자세히 보기 →
              </Link>
            </div>
          </div>
        ) : candidates.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-2">후보 책에 투표하세요!</p>
            {candidates.map((c) => {
              const bookVotes = getVotesForBook(c.book.id);
              const voted = hasVoted(c.book.id);
              return (
                <div
                  key={c.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                    voted ? "border-emerald-300 bg-emerald-50" : "border-gray-200"
                  )}
                >
                  {c.book.cover_url ? (
                    <img src={c.book.cover_url} alt={c.book.title} className="w-10 h-14 object-cover rounded" />
                  ) : (
                    <div className="w-10 h-14 bg-gray-200 rounded flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{c.book.title}</p>
                    <p className="text-xs text-gray-500 truncate">{c.book.author}</p>
                    {bookVotes.length > 0 && (
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {bookVotes.map(v => v.voter_name).join(', ')}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={voted ? 'primary' : 'outline'}
                    onClick={() => handleVote(c.book.id)}
                    disabled={isVoting === c.book.id}
                    className={cn(voted && "bg-emerald-600 hover:bg-emerald-700")}
                  >
                    {isVoting === c.book.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        {bookVotes.length}
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
            <Link
              href="/schedule"
              className="inline-block mt-2 text-emerald-600 hover:underline text-sm"
            >
              일정 투표 페이지에서 후보 추가 →
            </Link>
          </div>
        ) : (
          <div className="text-center py-8">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">선정된 책이 없습니다</p>
            <Link
              href="/schedule"
              className="inline-block mt-3 text-emerald-600 hover:underline text-sm"
            >
              일정 투표에서 후보 추가하기
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
