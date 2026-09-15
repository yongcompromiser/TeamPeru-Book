'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Book, Check, Loader2, Plus, ThumbsUp, X } from 'lucide-react';

/**
 * 모임의 책 후보 · 투표 · 선정.
 * 일정 화면(/schedule)에만 있던 기능을 모임 상세에서도 쓸 수 있게 분리했다.
 * API(/api/schedule/books)는 그대로 쓴다.
 *
 * 권한은 일정 화면과 동일하게 맞춘다.
 * - 투표: 정회원 (서버에서 한 번 더 막는다)
 * - 후보 추가·제거·선정: 관리자 또는 그 모임의 발제자
 */

interface BookType {
  id: string;
  title: string;
  author: string;
  cover_url?: string | null;
  status?: string;
}

interface Candidate {
  id: string;
  book_id: string;
  book: BookType;
}

interface Vote {
  book_id: string;
  user_id: string;
  voter_name?: string;
}

export function BookSelection({
  scheduleId,
  selectedBookId,
  canManage,
  canVote,
  currentUserId,
  onChanged,
}: {
  scheduleId: string;
  selectedBookId: string | null;
  canManage: boolean;
  canVote: boolean;
  currentUserId?: string;
  /** 선정이 바뀌면 상위에서 모임 정보를 다시 불러오도록 */
  onChanged: () => void | Promise<void>;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [availableBooks, setAvailableBooks] = useState<BookType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/schedule/books?scheduleId=${scheduleId}`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates || []);
        setVotes(data.votes || []);
      }
    } catch {
      /* 조회 실패 시 빈 목록 */
    }
    setIsLoading(false);
  }, [scheduleId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadAvailable = async () => {
    try {
      const res = await fetch('/api/books');
      if (res.ok) {
        const data = await res.json();
        setAvailableBooks(
          (data.books || []).filter((b: BookType) => b.status === 'waiting' || b.status === 'nominated')
        );
      }
    } catch {
      /* 무시 */
    }
  };

  const call = async (body: Record<string, unknown>, key: string) => {
    setBusy(key);
    try {
      const res = await fetch('/api/schedule/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId, ...body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || '처리에 실패했습니다.');
        return false;
      }
      return true;
    } catch {
      alert('처리에 실패했습니다.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const voteCount = (bookId: string) => votes.filter((v) => v.book_id === bookId).length;
  const votedByMe = (bookId: string) =>
    votes.some((v) => v.book_id === bookId && v.user_id === currentUserId);
  const voters = (bookId: string) =>
    votes.filter((v) => v.book_id === bookId).map((v) => v.voter_name ?? '알 수 없음');

  const toggleVote = async (bookId: string) => {
    const ok = await call(
      { action: votedByMe(bookId) ? 'unvote' : 'vote', bookId },
      `vote-${bookId}`
    );
    if (ok) await load();
  };

  const select = async (bookId: string) => {
    if (!confirm('이 책으로 선정할까요?')) return;
    const ok = await call({ action: 'select_book', bookId }, `select-${bookId}`);
    if (ok) {
      await load();
      await onChanged();
    }
  };

  const addCandidate = async (bookId: string) => {
    const ok = await call({ action: 'add_candidate', bookId }, `add-${bookId}`);
    if (ok) {
      setShowAdd(false);
      await load();
    }
  };

  const removeCandidate = async (candidateId: string) => {
    const ok = await call({ action: 'remove_candidate', candidateId }, `rm-${candidateId}`);
    if (ok) await load();
  };

  // 선정도 끝났고 후보도 없으면 굳이 자리를 차지하지 않는다
  if (!isLoading && candidates.length === 0 && selectedBookId && !canManage) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg flex items-center gap-2">
            <Book className="w-5 h-5 text-blue-600" />
            책 선정
            {selectedBookId && (
              <span className="text-xs font-normal text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                선정 완료
              </span>
            )}
          </CardTitle>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const next = !showAdd;
                setShowAdd(next);
                if (next) loadAvailable();
              }}
            >
              {showAdd ? (
                <>
                  <X className="w-4 h-4 mr-1" />
                  닫기
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  후보 추가
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* 후보 추가 */}
            {showAdd && (
              <div className="rounded-lg border border-dashed border-gray-300 p-3">
                <p className="text-sm font-medium text-gray-700 mb-2">후보로 올릴 책</p>
                <div className="max-h-56 overflow-y-auto space-y-2">
                  {availableBooks
                    .filter((b) => !candidates.some((c) => c.book_id === b.id))
                    .map((b) => (
                      <button
                        key={b.id}
                        onClick={() => addCandidate(b.id)}
                        disabled={busy === `add-${b.id}`}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 text-left transition-colors disabled:opacity-50"
                      >
                        <div className="w-9 h-12 rounded overflow-hidden bg-gray-100 shrink-0">
                          {b.cover_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={b.cover_url} alt={b.title} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{b.title}</p>
                          <p className="text-xs text-gray-500 truncate">{b.author}</p>
                        </div>
                        <Plus className="w-4 h-4 text-gray-400 shrink-0" />
                      </button>
                    ))}
                  {availableBooks.filter((b) => !candidates.some((c) => c.book_id === b.id)).length ===
                    0 && <p className="text-sm text-gray-400 py-2">추가할 수 있는 책이 없습니다.</p>}
                </div>
              </div>
            )}

            {/* 후보 목록 */}
            {candidates.length === 0 ? (
              <p className="text-sm text-gray-500">
                {canManage ? '후보 도서를 추가해보세요.' : '아직 후보 도서가 없습니다.'}
              </p>
            ) : (
              <div className="space-y-2">
                {candidates.map((c) => {
                  const isSelected = c.book_id === selectedBookId;
                  const count = voteCount(c.book_id);
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        'rounded-lg border p-3 transition-colors',
                        isSelected ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-14 rounded overflow-hidden bg-gray-100 shrink-0">
                          {c.book?.cover_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.book.cover_url}
                              alt={c.book.title}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {c.book?.title}
                            {isSelected && (
                              <span className="ml-2 text-xs font-medium text-green-700">선정됨</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{c.book?.author}</p>
                          {count > 0 && (
                            <p className="text-[11px] text-gray-400 mt-1 truncate">
                              {voters(c.book_id).join(', ')}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {canVote && (
                            <button
                              onClick={() => toggleVote(c.book_id)}
                              disabled={busy === `vote-${c.book_id}`}
                              className={cn(
                                'inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50',
                                votedByMe(c.book_id)
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              )}
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                              {count}
                            </button>
                          )}
                          {!canVote && (
                            <span className="text-xs text-gray-400 px-2">{count}표</span>
                          )}
                          {canManage && !selectedBookId && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={busy === `select-${c.book_id}`}
                              onClick={() => select(c.book_id)}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              선정
                            </Button>
                          )}
                        </div>
                      </div>

                      {canManage && !isSelected && (
                        <button
                          onClick={() => removeCandidate(c.id)}
                          disabled={busy === `rm-${c.id}`}
                          className="mt-2 text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-50"
                        >
                          후보에서 제거
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
