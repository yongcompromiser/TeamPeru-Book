'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import { ArrowLeft, X, Upload, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Schedule } from '@/types';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const gallerySchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요'),
  schedule_id: z.string().optional(),
  content: z.string().min(1, '내용을 입력해주세요'),
});

type GalleryFormData = z.infer<typeof gallerySchema>;

export default function NewGalleryPage() {
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<GalleryFormData>({
    resolver: zodResolver(gallerySchema),
  });

  useEffect(() => {
    fetchSchedules();
  }, []);

  useEffect(() => {
    setValue('content', content);
  }, [content, setValue]);

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from('schedules')
      .select('*, book:books(*)')
      .lte('meeting_date', new Date().toISOString())
      .order('meeting_date', { ascending: false })
      .limit(20);
    setSchedules((data as Schedule[]) || []);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setIsUploading(true);

    try {
      // Validate files
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          setError(`파일 크기는 10MB를 초과할 수 없습니다: ${file.name}`);
          setIsUploading(false);
          return;
        }
        if (!file.type.startsWith('image/')) {
          setError(`이미지 파일만 업로드할 수 있습니다: ${file.name}`);
          setIsUploading(false);
          return;
        }
      }

      const formData = new FormData();
      for (const file of Array.from(files)) {
        formData.append('files', file);
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '업로드 실패');
        return;
      }

      setPhotos([...photos, ...data.urls]);
    } catch (err) {
      setError('업로드 중 오류가 발생했습니다');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: GalleryFormData) => {
    if (!user) return;

    if (photos.length === 0) {
      setError('최소 1장의 사진을 업로드해주세요');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          content: data.content,
          photos: photos,
          schedule_id: data.schedule_id || null,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || '등록에 실패했습니다');
        setIsLoading(false);
        return;
      }

      router.push(`/gallery/${result.recap.id}`);
    } catch (e) {
      setError('등록에 실패했습니다');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/gallery"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        갤러리로
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>사진 올리기</CardTitle>
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
              placeholder="제목을 입력하세요"
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

            {/* Photo Upload */}
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                사진 (최대 10MB)
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors disabled:opacity-50"
              >
                {isUploading ? (
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>업로드 중...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <Upload className="w-8 h-8" />
                    <span>클릭하여 사진 선택</span>
                    <span className="text-xs">여러 장 선택 가능</span>
                  </div>
                )}
              </button>

              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-4">
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
            </div>

            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                설명
              </label>
              <div data-color-mode="light">
                <MDEditor
                  value={content}
                  onChange={(val) => setContent(val || '')}
                  height={200}
                  preview="edit"
                />
              </div>
              {errors.content && (
                <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" isLoading={isLoading} disabled={isUploading}>
                등록
              </Button>
              <Link href="/gallery">
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
