'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2 } from 'lucide-react';
import { KakaoLinkSection } from '@/components/auth/kakao-link-section';

const profileSchema = z.object({
  name: z.string().min(2, '이름은 최소 2자 이상이어야 합니다'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile?.name || '',
    },
  });

  const uploadImage = async (file: File) => {
    setIsUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('files', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || '업로드 실패' });
        setIsUploading(false);
        return;
      }

      const { urls } = await res.json();
      const avatarUrl = urls[0];

      // 프로필에 저장
      const saveRes = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      });

      if (saveRes.ok) {
        setAvatarPreview(avatarUrl);
        setMessage({ type: 'success', text: '프로필 이미지가 변경되었습니다' });
        try { await refreshProfile(); } catch {}
      } else {
        setMessage({ type: 'error', text: '프로필 저장에 실패했습니다' });
      }
    } catch {
      setMessage({ type: 'error', text: '업로드 중 오류가 발생했습니다' });
    }

    setIsUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          uploadImage(file);
          return;
        }
      }
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!profile) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: '프로필이 업데이트되었습니다' });
        try { await refreshProfile(); } catch {}
      } else {
        setMessage({ type: 'error', text: '프로필 업데이트에 실패했습니다' });
      }
    } catch {
      setMessage({ type: 'error', text: '프로필 업데이트에 실패했습니다' });
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

  const displayAvatar = avatarPreview || profile.avatar_url;

  return (
    <div className="max-w-2xl mx-auto" onPaste={handlePaste}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">프로필</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar src={displayAvatar} name={profile.name} size="lg" />
            <div>
              <CardTitle>{profile.name}</CardTitle>
              <p className="text-sm text-gray-600">{profile.email}</p>
              <Badge
                variant={profile.role === 'admin' ? 'info' : profile.role === 'guest' ? 'warning' : 'default'}
                className="mt-1"
              >
                {profile.role === 'admin' ? '관리자' : profile.role === 'guest' ? '게스트' : '멤버'}
              </Badge>
              {profile.role === 'guest' && (
                <p className="text-xs text-amber-700 mt-2">
                  게스트로 이용 중이에요. 정회원이 되고 싶다면 모임 관리자에게 알려주세요 — 관리자 페이지에서 바로 승격해드려요.
                </p>
              )}
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

            {/* 프로필 이미지 변경 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">프로필 이미지</label>
              <div className="flex items-center gap-4">
                <Avatar src={displayAvatar} name={profile.name} size="lg" />
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> 업로드 중...</>
                    ) : (
                      <><Camera className="w-4 h-4 mr-2" /> 이미지 변경</>
                    )}
                  </Button>
                  <p className="text-xs text-gray-400">파일 선택 또는 이 페이지에서 Ctrl+V로 붙여넣기</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            <Input
              id="name"
              type="text"
              label="이름"
              error={errors.name?.message}
              {...register('name')}
            />

            <div className="pt-4">
              <Button type="submit" isLoading={isLoading}>
                저장
              </Button>
            </div>

            <KakaoLinkSection />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
