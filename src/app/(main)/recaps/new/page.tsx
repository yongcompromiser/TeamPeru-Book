'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import { ArrowLeft, X, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Schedule } from '@/types';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

const recapSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요'),
  schedule_id: z.string().optional(),
  content: z.string().min(10, '내용을 10자 이상 입력해주세요'),
  photos: z.array(z.string().url()).optional(),
});

type RecapFormData = z.infer<typeof recapSchema>;

export default function NewRecapPage() {
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RecapFormData>({
    resolver: zodResolver(recapSchema),
  });

  useEffect(() => {
    fetchSchedules();
  }, []);

  useEffect(() => {
    setValue('content', content);
  }, [content, setValue]);

  useEffect(() => {
    setValue('photos', photos);
  }, [photos, setValue]);

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from('schedules')
      .select('*, book:books(*)')
      .lte('meeting_date', new Date().toISOString())
      .order('meeting_date', { ascending: false })
      .limit(20);
    setSchedules((data as Schedule[]) || []);
  };

  const addPhoto = () => {
    if (newPhotoUrl && newPhotoUrl.startsWith('http')) {
      setPhotos([...photos, newPhotoUrl]);
      setNewPhotoUrl('');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: RecapFormData) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    const { data: recap, error: insertError } = await supabase
      .from('recaps')
      .insert({
        title: data.title,
        schedule_id: data.schedule_id || null,
        content: data.content,
        photos: photos,
        user_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      setError('후기 등록에 실패했습니다');
      setIsLoading(false);
      return;
    }

    router.push(`/recaps/${recap.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/recaps"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        후기 목록으로
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>모임 후기 작성</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <Input
              id="title"
              label="제목"
              placeholder="후기 제목을 입력하세요"
              error={errors.title?.message}
              {...register('title')}
            />

            <div className="w-full">
              <label
                htmlFor="schedule_id"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                관련 모임 (선택)
              </label>
              <select
                id="schedule_id"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                {...register('schedule_id')}
              >
                <option value="">선택 안함</option>
                {schedules.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Photo URLs */}
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                사진 URL (선택)
              </label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={addPhoto}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={photo}
                        alt={`사진 ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                사진 URL을 입력하고 + 버튼을 클릭하세요
              </p>
            </div>

            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                내용
              </label>
              <div data-color-mode="light">
                <MDEditor
                  value={content}
                  onChange={(val) => setContent(val || '')}
                  height={400}
                  preview="edit"
                />
              </div>
              {errors.content && (
                <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" isLoading={isLoading}>
                등록
              </Button>
              <Link href="/recaps">
                <Button type="button" variant="outline">
                  취소
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
