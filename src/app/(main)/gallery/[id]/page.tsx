import { notFound } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, Calendar } from 'lucide-react';
import { CommentSection } from '@/components/features/comment-section';

export const dynamic = 'force-dynamic';

interface GalleryPageProps {
  params: Promise<{ id: string }>;
}

export default async function GalleryDetailPage({ params }: GalleryPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: recap } = await supabase
    .from('recaps')
    .select('*, profile:profiles(*), schedule:schedules(*, book:books(*))')
    .eq('id', id)
    .single();

  if (!recap) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/gallery"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        갤러리로
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-4">
            <Avatar
              src={recap.profile?.avatar_url}
              name={recap.profile?.name || ''}
              size="md"
            />
            <div>
              <p className="font-medium text-gray-900">{recap.profile?.name}</p>
              <p className="text-sm text-gray-500">
                {formatDate(recap.created_at)}
              </p>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">{recap.title}</h1>

          {recap.schedule && (
            <Link
              href={`/schedule/${recap.schedule.id}`}
              className="inline-flex items-center gap-2 mt-3 text-sm text-blue-600 hover:underline"
            >
              <Calendar className="w-4 h-4" />
              {recap.schedule.title}
              {recap.schedule.book && (
                <Badge variant="info" className="ml-2">
                  {recap.schedule.book.title}
                </Badge>
              )}
            </Link>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Photo Gallery */}
          {recap.photos && recap.photos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {recap.photos.map((photo: string, index: number) => (
                <a
                  key={index}
                  href={photo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square overflow-hidden rounded-lg"
                >
                  <img
                    src={photo}
                    alt={`사진 ${index + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </a>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{recap.content}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      <CommentSection commentableType="recap" commentableId={id} />
    </div>
  );
}
