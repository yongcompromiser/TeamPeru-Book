'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, User, Clock, Send, Loader2, Trash2, MessageSquare, Eye, Pencil, Pin, X, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';

interface Post {
  id: string;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  updated_at?: string | null;
  is_pinned?: boolean;
  view_count?: number;
  profile?: { name: string; avatar_url?: string | null };
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at?: string | null;
  profile?: { name: string; avatar_url?: string | null };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PostDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, profile } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [commentInput, setCommentInput] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  const isAdmin = profile?.role === 'admin';
  const isAuthor = post?.user_id === user?.id;
  const canEdit = isAdmin || isAuthor;

  useEffect(() => {
    fetchPost();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchPost = async () => {
    try {
      const res = await fetch(`/api/board/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPost(data.post);
        setComments(data.comments || []);
      }
    } catch (e) {
      console.log('Failed to fetch post');
    }
    setIsLoading(false);
  };

  const handleAddComment = async () => {
    if (!commentInput.trim() || !user) return;
    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/board/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
        setCommentInput('');
      }
    } catch (e) {
      console.log('Failed to add comment');
    }
    setIsSubmittingComment(false);
  };

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/board/${id}`, { method: 'DELETE' });
      if (res.ok) router.push('/board');
    } catch (e) {
      console.log('Failed to delete post');
    }
    setIsDeleting(false);
  };

  const handleTogglePin = async () => {
    if (!post) return;
    setIsPinning(true);
    try {
      const res = await fetch(`/api/board/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_pin', is_pinned: !post.is_pinned }),
      });
      if (res.ok) setPost({ ...post, is_pinned: !post.is_pinned });
    } catch (e) {
      console.log('Failed to toggle pin');
    }
    setIsPinning(false);
  };

  const handleEditComment = async (commentId: string) => {
    if (!editCommentText.trim()) return;
    try {
      const res = await fetch(`/api/board/${id}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editCommentText }),
      });
      if (res.ok) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, content: editCommentText.trim() } : c))
        );
        setEditingComment(null);
        setEditCommentText('');
      }
    } catch (e) {
      console.log('Failed to edit comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/board/${id}/comments/${commentId}`, { method: 'DELETE' });
      if (res.ok) setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (e) {
      console.log('Failed to delete comment');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">게시글을 찾을 수 없습니다</p>
        <Link href="/board" className="text-blue-600 hover:underline mt-2 inline-block">
          목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/board"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        목록으로
      </Link>

      {/* 게시글 */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-xl flex items-center gap-2">
                {post.is_pinned && <Pin className="w-4 h-4 text-amber-600 fill-amber-500 flex-shrink-0" />}
                {post.title}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar src={post.profile?.avatar_url} name={post.profile?.name || ''} size="xs" />
                    {post.profile?.name || '알 수 없음'}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {format(new Date(post.created_at), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                  {post.updated_at && <span className="text-gray-400 ml-1">(수정됨)</span>}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {post.view_count ?? 0}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTogglePin}
                  disabled={isPinning}
                  className={cn(post.is_pinned && 'bg-amber-50 text-amber-700 border-amber-300')}
                  title={post.is_pinned ? '고정 해제' : '공지로 고정'}
                >
                  {isPinning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pin className={cn('w-4 h-4', post.is_pinned && 'fill-amber-500')} />}
                </Button>
              )}
              {canEdit && (
                <>
                  <Link href={`/board/${id}/edit`}>
                    <Button variant="outline" size="sm" title="수정">
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="삭제"
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 whitespace-pre-wrap">{post.content}</p>
        </CardContent>
      </Card>

      {/* 댓글 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            댓글 {comments.length > 0 && `(${comments.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment) => {
                const mine = comment.user_id === user?.id;
                const canManage = mine || isAdmin;
                const editing = editingComment === comment.id;
                return (
                  <div
                    key={comment.id}
                    className={cn('p-3 rounded-lg', mine ? 'bg-blue-50' : 'bg-gray-50')}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-gray-900 inline-flex items-center gap-1.5">
                        <Avatar src={comment.profile?.avatar_url} name={comment.profile?.name || ''} size="xs" />
                        {comment.profile?.name || '알 수 없음'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {format(new Date(comment.created_at), 'M/d HH:mm')}
                        {comment.updated_at && <span className="ml-1">(수정됨)</span>}
                      </span>
                      {canManage && !editing && (
                        <span className="ml-auto flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingComment(comment.id);
                              setEditCommentText(comment.content);
                            }}
                            className="text-gray-400 hover:text-gray-700"
                            title="수정"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-gray-400 hover:text-red-600"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}
                    </div>
                    {editing ? (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={editCommentText}
                          onChange={(e) => setEditCommentText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleEditComment(comment.id);
                            }
                          }}
                          className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleEditComment(comment.id)}
                          className="text-green-600 hover:text-green-700"
                          title="저장"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingComment(null);
                            setEditCommentText('');
                          }}
                          className="text-gray-400 hover:text-gray-600"
                          title="취소"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-gray-700 text-sm whitespace-pre-wrap">{comment.content}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">아직 댓글이 없습니다</p>
          )}

          {user && (
            <div className="flex gap-2 pt-4 border-t">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                placeholder="댓글을 입력하세요..."
                className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Button onClick={handleAddComment} disabled={isSubmittingComment || !commentInput.trim()}>
                {isSubmittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
