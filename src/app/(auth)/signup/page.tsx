'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const signupSchema = z
  .object({
    name: z.string().min(2, '이름은 최소 2자 이상이어야 합니다'),
    email: z.string().email('유효한 이메일을 입력해주세요'),
    password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setError(null);

    const { error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>회원가입</CardTitle>
        <CardDescription>새 계정을 만들어 시작하세요</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <Input
            id="name"
            type="text"
            label="이름"
            placeholder="홍길동"
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            id="email"
            type="email"
            label="이메일"
            placeholder="email@example.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            id="password"
            type="password"
            label="비밀번호"
            placeholder="6자 이상 입력하세요"
            error={errors.password?.message}
            {...register('password')}
          />

          <Input
            id="confirmPassword"
            type="password"
            label="비밀번호 확인"
            placeholder="비밀번호를 다시 입력하세요"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <Button type="submit" className="w-full" isLoading={isLoading}>
            회원가입
          </Button>

          <p className="text-center text-sm text-gray-600">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              로그인
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
