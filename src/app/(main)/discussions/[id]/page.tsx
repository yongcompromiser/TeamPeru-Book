import { notFound } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { CommentSection } from '@/components/features/comment-section';

export const dynamic = 'force-dynamic';

interface DiscussionPageProps {
  params: Promise<{ id: string }>;
}

export default async function DiscussionDetailPage({ params }: DiscussionPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: discussion } = await supabase
    .from('discussions')
    .select('*, profile:profiles(*), book:books(*)')
    .eq('id', id)
    .single();

  if (!discussion) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/discussions"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        발제 목록으로
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-4">
            <Avatar
              src={discussion.profile?.avatar_url}
              name={discussion.profile?.name || ''}
              size="md"
            />
            <div>
              <p className="font-medium text-gray-900">{discussion.profile?.name}</p>
              <p className="text-sm text-gray-500">
                {formatDate(discussion.created_at)}
              </p>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{discussion.title}</h1>
          {discussion.book && (
            <Link
              href={`/books/${discussion.book.id}`}
              className="inline-flex items-center gap-2 mt-3 text-sm text-blue-600 hover:underline"
            >
              <BookOpen className="w-4 h-4" />
              {discussion.book.title} - {discussion.book.author}
            </Link>
          )}
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{discussion.content}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      <CommentSection commentableType="discussion" commentableId={id} />
    </div>
  );
}
