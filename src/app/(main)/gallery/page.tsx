import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { formatDate } from '@/lib/utils';
import { Plus, Camera, Image } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function GalleryPage() {
  const supabase = await createClient();

  const { data: recaps } = await supabase
    .from('recaps')
    .select('*, profile:profiles(*), schedule:schedules(*, book:books(*))')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">갤러리</h1>
        <Link href="/gallery/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            사진 올리기
          </Button>
        </Link>
      </div>

      {recaps && recaps.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {recaps.map((recap) => (
            <Link key={recap.id} href={`/gallery/${recap.id}`}>
              <Card className="h-full hover:border-blue-300 transition-colors overflow-hidden">
                {recap.photos && recap.photos.length > 0 ? (
                  <img
                    src={recap.photos[0]}
                    alt={recap.title}
                    className="w-full h-40 object-cover"
                  />
                ) : (
                  <div className="w-full h-40 bg-gray-100 flex items-center justify-center">
                    <Image className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar
                      src={recap.profile?.avatar_url}
                      name={recap.profile?.name || ''}
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {recap.profile?.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(recap.created_at, { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-2 truncate">
                    {recap.title}
                  </h3>

                  {recap.photos && recap.photos.length > 1 && (
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <Camera className="w-3 h-3" />
                      +{recap.photos.length - 1} 사진
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">아직 사진이 없습니다</p>
            <Link href="/gallery/new">
              <Button>첫 번째 사진 올리기</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
