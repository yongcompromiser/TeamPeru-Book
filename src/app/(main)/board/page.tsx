'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { MessageCircle, Plus, MessageSquare, Pin, Heart, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { BOARD_CATEGORIES, categoryBadge } from '@/lib/board';

interface Post {
  id: string;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  category?: string;
  is_pinned?: boolean;
  like_count?: number;
  comment_count?: number;
  profile?: { name: string; avatar_url?: string | null };
}

const POST_IT_COLORS = [
  'bg-yellow-200 hover:bg-yellow-300',
  'bg-pink-200 hover:bg-pink-300',
  'bg-blue-200 hover:bg-blue-300',
  'bg-green-200 hover:bg-green-300',
  'bg-purple-200 hover:bg-purple-300',
  'bg-orange-200 hover:bg-orange-300',
];
const ROTATIONS = ['-rotate-2', 'rotate-1', '-rotate-1', 'rotate-2', 'rotate-0', '-rotate-3'];
const LIMIT = 24;

export default function BoardPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [category, setCategory] = useState('전체');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(
    async (reset: boolean) => {
      const offset = reset ? 0 : posts.length;
      if (reset) setIsLoading(true);
      else setIsLoadingMore(true);
      try {
        const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
        if (category !== '전체') params.set('category', category);
        if (query) params.set('q', query);
        const res = await fetch(`/api/board?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setPosts((prev) => (reset ? data.posts || [] : [...prev, ...(data.posts || [])]));
          setHasMore(!!data.hasMore);
        }
      } catch (e) {
        console.log('Failed to fetch posts');
      }
      setIsLoading(false);
      setIsLoadingMore(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category, query]
  );

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, query]);

  const pinned = posts.filter((p) => p.is_pinned);
  const normal = posts.filter((p) => !p.is_pinned);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageCircle className="w-7 h-7" />
          자유게시판
        </h1>
        {user && (
          <Link href="/board/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              글쓰기
            </Button>
          </Link>
        )}
      </div>

      {/* 카테고리 필터 + 검색 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {['전체', ...BOARD_CATEGORIES.map((c) => c.key)].map((key) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border transition-colors',
                category === key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              )}
            >
              {key}
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQuery(search.trim());
            }}
            placeholder="제목·내용 검색"
            className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 animate-pulse bg-yellow-100 rounded-sm shadow-md" />
          ))}
        </div>
      ) : (
        <>
          {/* 📌 공지(고정글) */}
          {pinned.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 divide-y divide-amber-100 overflow-hidden">
              {pinned.map((post) => (
                <Link
                  key={post.id}
                  href={`/board/${post.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-amber-100/60 transition-colors"
                >
                  <Pin className="w-4 h-4 text-amber-600 flex-shrink-0 fill-amber-500" />
                  <span className="font-semibold text-gray-800 truncate flex-1">{post.title}</span>
                  <span className="text-xs text-gray-500 flex items-center gap-2 flex-shrink-0">
                    {(post.like_count ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <Heart className="w-3.5 h-3.5" />
                        {post.like_count}
                      </span>
                    )}
                    {(post.comment_count ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {post.comment_count}
                      </span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {normal.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-4">
                {normal.map((post, index) => {
                  const cat = categoryBadge(post.category);
                  return (
                    <Link key={post.id} href={`/board/${post.id}`}>
                      <div
                        className={cn(
                          'relative p-4 min-h-[168px] rounded-sm shadow-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105',
                          POST_IT_COLORS[index % POST_IT_COLORS.length],
                          ROTATIONS[index % ROTATIONS.length]
                        )}
                        style={{ boxShadow: '2px 2px 8px rgba(0,0,0,0.15), inset 0 -40px 36px -36px rgba(0,0,0,0.05)' }}
                      >
                        <div
                          className="absolute top-0 right-0 w-0 h-0"
                          style={{
                            borderStyle: 'solid',
                            borderWidth: '0 20px 20px 0',
                            borderColor: 'transparent rgba(0,0,0,0.1) transparent transparent',
                          }}
                        />
                        <span className={cn('inline-block mb-2 px-2 py-0.5 rounded-full text-[10px] font-semibold border', cat.badge)}>
                          {cat.label}
                        </span>
                        <h3 className="font-bold text-gray-800 mb-1.5 line-clamp-2 text-sm">{post.title}</h3>
                        <p className="text-xs text-gray-700 line-clamp-3 mb-3">{post.content}</p>

                        <div className="absolute bottom-3 left-4 right-4">
                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <span className="font-medium inline-flex items-center gap-1.5">
                              <Avatar src={post.profile?.avatar_url} name={post.profile?.name || ''} size="xs" />
                              {post.profile?.name || '익명'}
                            </span>
                            <span>{format(new Date(post.created_at), 'M/d', { locale: ko })}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                            {(post.like_count ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-0.5">
                                <Heart className="w-3 h-3" />
                                {post.like_count}
                              </span>
                            )}
                            {(post.comment_count ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-0.5">
                                <MessageSquare className="w-3 h-3" />
                                {post.comment_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {hasMore && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => load(false)} disabled={isLoadingMore}>
                    {isLoadingMore ? '불러오는 중…' : '더보기'}
                  </Button>
                </div>
              )}
            </>
          ) : (
            pinned.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-yellow-200 p-8 rounded-sm shadow-lg -rotate-2" style={{ boxShadow: '2px 2px 8px rgba(0,0,0,0.15)' }}>
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-yellow-600" />
                  <p className="text-gray-700 font-medium">
                    {query || category !== '전체' ? '해당하는 글이 없습니다' : '아직 게시글이 없습니다'}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {query || category !== '전체' ? '다른 조건으로 찾아보세요' : '첫 번째 글을 작성해보세요!'}
                  </p>
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
