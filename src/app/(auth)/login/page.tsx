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

const loginSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
});

const resetSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  newPassword: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirmPassword'],
});

type LoginFormData = z.infer<typeof loginSchema>;
type ResetFormData = z.infer<typeof resetSchema>;

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'reset'>('login');

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const resetForm = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  const onLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const { error, data: authData } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다');
        setIsLoading(false);
        return;
      }

      if (authData?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();

        if (profile?.role === 'pending') {
          window.location.href = '/pending';
          return;
        }
      }

      window.location.href = '/dashboard';
    } catch (e) {
      console.error('Login error:', e);
      setError('로그인 중 오류가 발생했습니다');
      setIsLoading(false);
    }
  };

  const onReset = async (data: ResetFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, newPassword: data.newPassword }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || '비밀번호 변경에 실패했습니다');
        setIsLoading(false);
        return;
      }

      setSuccess('비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요.');
      resetForm.reset();
      setTimeout(() => {
        setMode('login');
        setSuccess(null);
      }, 2000);
    } catch (e) {
      console.error('Reset error:', e);
      setError('비밀번호 변경 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode: 'login' | 'reset') => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === 'login' ? '로그인' : '비밀번호 변경'}</CardTitle>
        <CardDescription>
          {mode === 'login' ? '계정에 로그인하세요' : '이메일과 새 비밀번호를 입력하세요'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-600 text-sm p-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
            <Input
              id="email"
              type="email"
              label="이메일"
              placeholder="email@example.com"
              error={loginForm.formState.errors.email?.message}
              {...loginForm.register('email')}
            />

            <Input
              id="password"
              type="password"
              label="비밀번호"
              placeholder="비밀번호를 입력하세요"
              error={loginForm.formState.errors.password?.message}
              {...loginForm.register('password')}
            />

            <Button type="submit" className="w-full" isLoading={isLoading}>
              로그인
            </Button>

            <div className="flex justify-between text-sm">
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="text-gray-500 hover:text-gray-700 hover:underline"
              >
                비밀번호 변경
              </button>
              <Link href="/signup" className="text-blue-600 hover:underline">
                회원가입
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-4">
            <Input
              id="reset-email"
              type="email"
              label="이메일"
              placeholder="email@example.com"
              error={resetForm.formState.errors.email?.message}
              {...resetForm.register('email')}
            />

            <Input
              id="new-password"
              type="password"
              label="새 비밀번호"
              placeholder="6자 이상 입력하세요"
              error={resetForm.formState.errors.newPassword?.message}
              {...resetForm.register('newPassword')}
            />

            <Input
              id="confirm-password"
              type="password"
              label="새 비밀번호 확인"
              placeholder="비밀번호를 다시 입력하세요"
              error={resetForm.formState.errors.confirmPassword?.message}
              {...resetForm.register('confirmPassword')}
            />

            <Button type="submit" className="w-full" isLoading={isLoading}>
              비밀번호 변경
            </Button>

            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 hover:underline"
            >
              로그인으로 돌아가기
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
