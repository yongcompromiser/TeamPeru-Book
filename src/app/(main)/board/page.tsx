'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { MessageCircle, Plus, MessageSquare, Pin, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';

interface Post {
  id: string;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  is_pinned?: boolean;
  view_count?: number;
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

export default function BoardPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/board');
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (e) {
      console.log('Failed to fetch posts');
    }
    setIsLoading(false);
  };

  const pinned = posts.filter((p) => p.is_pinned);
  const normal = posts.filter((p) => !p.is_pinned);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">자유게시판</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 animate-pulse bg-yellow-100 rounded-sm shadow-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* 📌 공지(고정글) — 상단 컴팩트 리스트 */}
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
              <span className="hidden sm:inline text-xs text-gray-500 truncate max-w-[30%]">
                {post.content}
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-2 flex-shrink-0">
                <span className="inline-flex items-center gap-0.5">
                  <Eye className="w-3.5 h-3.5" />
                  {post.view_count ?? 0}
                </span>
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-4">
          {normal.map((post, index) => (
            <Link key={post.id} href={`/board/${post.id}`}>
              <div
                className={cn(
                  'relative p-4 min-h-[160px] rounded-sm shadow-lg cursor-pointer transition-all hover:shadow-xl hover:scale-105',
                  POST_IT_COLORS[index % POST_IT_COLORS.length],
                  ROTATIONS[index % ROTATIONS.length]
                )}
                style={{
                  boxShadow: '2px 2px 8px rgba(0,0,0,0.15), inset 0 -40px 36px -36px rgba(0,0,0,0.05)',
                }}
              >
                <div
                  className="absolute top-0 right-0 w-0 h-0"
                  style={{
                    borderStyle: 'solid',
                    borderWidth: '0 20px 20px 0',
                    borderColor: 'transparent rgba(0,0,0,0.1) transparent transparent',
                  }}
                />

                <h3 className="font-bold text-gray-800 mb-2 line-clamp-2 text-sm">{post.title}</h3>
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
                    <span className="inline-flex items-center gap-0.5">
                      <Eye className="w-3 h-3" />
                      {post.view_count ?? 0}
                    </span>
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
          ))}
        </div>
      ) : (
        pinned.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div
              className="bg-yellow-200 p-8 rounded-sm shadow-lg -rotate-2"
              style={{ boxShadow: '2px 2px 8px rgba(0,0,0,0.15)' }}
            >
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-yellow-600" />
              <p className="text-gray-700 font-medium">아직 게시글이 없습니다</p>
              <p className="text-sm text-gray-600 mt-1">첫 번째 글을 작성해보세요!</p>
            </div>
          </div>
        )
      )}
    </div>
  );
}
