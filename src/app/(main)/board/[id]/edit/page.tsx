'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Save } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditPostPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, profile } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/board/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.post) {
            setTitle(data.post.title || '');
            setContent(data.post.content || '');
            setAuthorId(data.post.user_id || null);
          }
        }
      } catch (e) {
        console.log('Failed to load post');
      }
      setIsLoading(false);
    })();
  }, [id]);

  const isAdmin = profile?.role === 'admin';
  const canEdit = !isLoading && user && (user.id === authorId || isAdmin);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 모두 입력해주세요');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/board/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      if (res.ok) {
        router.push(`/board/${id}`);
      } else {
        const data = await res.json();
        setError(data.error || '수정에 실패했습니다');
      }
    } catch (e) {
      setError('수정에 실패했습니다');
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">이 글을 수정할 권한이 없습니다</p>
        <Link href={`/board/${id}`} className="text-blue-600 hover:underline mt-2 inline-block">
          글로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={`/board/${id}`}
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        글로 돌아가기
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>글 수정</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력하세요"
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="내용을 입력하세요"
                className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-48"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Link href={`/board/${id}`}>
                <Button type="button" variant="outline">
                  취소
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                저장하기
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
