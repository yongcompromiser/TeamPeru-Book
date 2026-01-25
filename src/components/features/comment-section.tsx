'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { formatDate } from '@/lib/utils';
import { MessageSquare, Trash2 } from 'lucide-react';
import { Comment, CommentableType } from '@/types';

const commentSchema = z.object({
  content: z.string().min(1, '댓글을 입력해주세요'),
});

type CommentFormData = z.infer<typeof commentSchema>;

interface CommentSectionProps {
  commentableType: CommentableType;
  commentableId: string;
}

export function CommentSection({ commentableType, commentableId }: CommentSectionProps) {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
  });

  useEffect(() => {
    fetchComments();
  }, [commentableId]);

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*, profile:profiles(*)')
      .eq('commentable_type', commentableType)
      .eq('commentable_id', commentableId)
      .order('created_at', { ascending: true });

    setComments((data as Comment[]) || []);
  };

  const onSubmit = async (data: CommentFormData) => {
    if (!user) return;

    setIsLoading(true);

    await supabase.from('comments').insert({
      commentable_type: commentableType,
      commentable_id: commentableId,
      user_id: user.id,
      content: data.content,
    });

    reset();
    await fetchComments();
    setIsLoading(false);
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;

    await supabase.from('comments').delete().eq('id', commentId);
    await fetchComments();
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          댓글 ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comment List */}
        {comments.length > 0 ? (
          <ul className="space-y-4">
            {comments.map((comment) => (
              <li key={comment.id} className="flex gap-3">
                <Avatar
                  src={comment.profile?.avatar_url}
                  name={comment.profile?.name || ''}
                  size="sm"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">
                      {comment.profile?.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(comment.created_at, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm mt-1 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                  {(user?.id === comment.user_id || isAdmin) && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-xs text-red-500 hover:text-red-700 mt-1 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      삭제
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-center py-4">첫 번째 댓글을 작성해보세요</p>
        )}

        {/* Comment Form */}
        {user ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pt-4 border-t">
            <Textarea
              placeholder="댓글을 입력하세요"
              rows={3}
              error={errors.content?.message}
              {...register('content')}
            />
            <Button type="submit" size="sm" isLoading={isLoading}>
              댓글 작성
            </Button>
          </form>
        ) : (
          <p className="text-gray-500 text-center py-4 border-t pt-4">
            댓글을 작성하려면 로그인하세요
          </p>
        )}
      </CardContent>
    </Card>
  );
}
