import { createClient } from '@supabase/supabase-js';

/**
 * 가입 승인 안내 메일.
 *
 * 별도 메일 서비스를 두지 않고 Supabase Auth 의 SMTP 로 보낸다.
 * Supabase 에는 "아무 내용이나 보내는" API 가 없어서, 매직링크 발송을 빌려 쓴다.
 * 문구는 대시보드의 Authentication → Email Templates → Magic Link 에서 바꾼다.
 * (이 앱은 다른 곳에서 매직링크를 쓰지 않아 템플릿을 승인 안내용으로 전용해도 된다.
 *  카카오 로그인은 generateLink 로 링크만 만들고 메일을 보내지 않는다.)
 *
 * 받는 사람이 링크를 누르면 /auth/confirm 에서 바로 로그인된다.
 * 링크가 만료돼도 본인이 정한 비밀번호로 로그인하면 되므로 치명적이지 않다.
 */

/** 카카오 게스트는 실제 주소가 아닌 placeholder 를 쓴다. 여기로는 보내면 안 된다. */
export const isRealEmail = (email: string | null | undefined): boolean =>
  !!email && !email.endsWith('@kakao.local') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export type MailResult = { sent: boolean; reason?: string };

export async function sendApprovalEmail(email: string, origin: string): Promise<MailResult> {
  if (!isRealEmail(email)) {
    return { sent: false, reason: '실제 메일 주소가 아니라 보내지 않았습니다. (카카오 게스트)' };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { sent: false, reason: 'Supabase 환경변수가 없습니다.' };
  }

  // 관리자 세션과 섞이면 안 되므로 세션을 저장하지 않는 독립 클라이언트를 쓴다
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      // 이미 있는 계정에만 보낸다. 오타로 새 계정이 생기면 안 된다.
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    console.error('승인 안내 메일 발송 실패:', error.message);
    return { sent: false, reason: error.message };
  }
  return { sent: true };
}
