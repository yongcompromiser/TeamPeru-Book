'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const profileSchema = z.object({
  name: z.string().min(2, '이름은 최소 2자 이상이어야 합니다'),
  avatar_url: z.string().url('유효한 URL을 입력해주세요').optional().or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile?.name || '',
      avatar_url: profile?.avatar_url || '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    if (!profile) return;

    setIsLoading(true);
    setMessage(null);

    const { error } = await supabase
      .from('profiles')
      .update({
        name: data.name,
        avatar_url: data.avatar_url || null,
      })
      .eq('id', profile.id);

    if (error) {
      setMessage({ type: 'error', text: '프로필 업데이트에 실패했습니다' });
    } else {
      setMessage({ type: 'success', text: '프로필이 업데이트되었습니다' });
      await refreshProfile();
    }

    setIsLoading(false);
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">프로필</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar src={profile.avatar_url} name={profile.name} size="lg" />
            <div>
              <CardTitle>{profile.name}</CardTitle>
              <p className="text-sm text-gray-600">{profile.email}</p>
              <Badge variant={profile.role === 'admin' ? 'info' : 'default'} className="mt-1">
                {profile.role === 'admin' ? '관리자' : '멤버'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {message && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-600'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {message.text}
              </div>
            )}

            <Input
              id="name"
              type="text"
              label="이름"
              error={errors.name?.message}
              {...register('name')}
            />

            <Input
              id="avatar_url"
              type="url"
              label="프로필 이미지 URL"
              placeholder="https://example.com/avatar.jpg"
              error={errors.avatar_url?.message}
              {...register('avatar_url')}
            />

            <div className="pt-4">
              <Button type="submit" isLoading={isLoading}>
                저장
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
