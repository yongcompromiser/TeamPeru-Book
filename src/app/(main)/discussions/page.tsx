import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { formatDate } from '@/lib/utils';
import { Plus, MessageSquare } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DiscussionsPage() {
  const supabase = await createClient();

  const { data: discussions } = await supabase
    .from('discussions')
    .select('*, profile:profiles(*), book:books(*)')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">발제</h1>
        <Link href="/discussions/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            발제 작성
          </Button>
        </Link>
      </div>

      {discussions && discussions.length > 0 ? (
        <div className="space-y-4">
          {discussions.map((discussion) => (
            <Link key={discussion.id} href={`/discussions/${discussion.id}`}>
              <Card className="hover:border-blue-300 transition-colors">
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <Avatar
                      src={discussion.profile?.avatar_url}
                      name={discussion.profile?.name || ''}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {discussion.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {discussion.content.replace(/[#*`]/g, '').slice(0, 150)}...
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                        <span>{discussion.profile?.name}</span>
                        <span>·</span>
                        <span>{formatDate(discussion.created_at, { month: 'short', day: 'numeric' })}</span>
                        {discussion.book && (
                          <>
                            <span>·</span>
                            <Badge variant="info">{discussion.book.title}</Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">아직 발제가 없습니다</p>
            <Link href="/discussions/new">
              <Button>첫 번째 발제 작성하기</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
