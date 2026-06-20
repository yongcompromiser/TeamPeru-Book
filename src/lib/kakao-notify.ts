// 카카오 "나에게 보내기" 알림 오케스트레이션 (서버 전용).
// 각 회원의 카카오 토큰을 kakao_tokens 에 저장해두고, 이벤트 발생 시
// 그 회원 본인의 카카오 '나와의 채팅'으로 메시지를 보낸다.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { refreshKakaoToken, sendKakaoMemo, type KakaoTokens } from '@/lib/kakao';

type Admin = SupabaseClient;

// 로그인/연결 시 받은 토큰을 저장(업서트).
// 토큰 저장 실패(예: 마이그레이션 미적용)가 로그인을 막으면 안 되므로 삼킨다.
export async function storeKakaoTokens(admin: Admin, userId: string, tokens: KakaoTokens): Promise<void> {
  try {
    const now = Date.now();
    const { error } = await admin.from('kakao_tokens').upsert(
      {
        user_id: userId,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        access_expires_at: new Date(now + tokens.expiresIn * 1000).toISOString(),
        refresh_expires_at: tokens.refreshTokenExpiresIn
          ? new Date(now + tokens.refreshTokenExpiresIn * 1000).toISOString()
          : null,
        updated_at: new Date(now).toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (error) console.error('storeKakaoTokens 실패:', userId, error.message);
  } catch (e) {
    console.error('storeKakaoTokens 예외:', userId, e);
  }
}

// 유효한 access token 을 돌려준다. 만료가 임박하면 refresh 로 갱신한다.
// 토큰이 없거나(알림 미동의) refresh 도 만료면 null.
async function getValidAccessToken(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin.from('kakao_tokens').select('*').eq('user_id', userId).maybeSingle();
  if (!data) return null;

  const now = Date.now();
  // 만료 1분 이상 여유 있으면 그대로 사용
  if (new Date(data.access_expires_at).getTime() - now > 60_000) {
    return data.access_token;
  }
  if (!data.refresh_token) return null;
  if (data.refresh_expires_at && new Date(data.refresh_expires_at).getTime() < now) return null;

  try {
    const refreshed = await refreshKakaoToken(data.refresh_token);
    const update: Record<string, unknown> = {
      access_token: refreshed.accessToken,
      access_expires_at: new Date(now + refreshed.expiresIn * 1000).toISOString(),
      updated_at: new Date(now).toISOString(),
    };
    // 카카오는 refresh token 만료가 가까울 때만 새 refresh token 을 준다
    if (refreshed.refreshToken) {
      update.refresh_token = refreshed.refreshToken;
      if (refreshed.refreshTokenExpiresIn) {
        update.refresh_expires_at = new Date(now + refreshed.refreshTokenExpiresIn * 1000).toISOString();
      }
    }
    await admin.from('kakao_tokens').update(update).eq('user_id', userId);
    return refreshed.accessToken;
  } catch {
    return null;
  }
}

export type NotifyResult = { ok: boolean; reason?: 'no_token' | 'send_failed' };

// 특정 사용자 본인에게 "나에게 보내기" 발송
export async function sendSelfNotification(userId: string, text: string, webUrl: string): Promise<NotifyResult> {
  const admin = createAdminClient();
  const token = await getValidAccessToken(admin, userId);
  if (!token) return { ok: false, reason: 'no_token' };
  try {
    await sendKakaoMemo(token, text, webUrl);
    return { ok: true };
  } catch (e) {
    console.error('sendSelfNotification 실패:', userId, e);
    return { ok: false, reason: 'send_failed' };
  }
}

// 전체 멤버(role: member/admin)에게 발송. 토큰 없는 사람은 건너뛴다.
// excludeUserId: 보통 이벤트를 일으킨 본인은 제외할 때 사용.
export async function notifyMembers(
  text: string,
  webUrl: string,
  options?: { excludeUserId?: string }
): Promise<{ sent: number; skipped: number }> {
  const admin = createAdminClient();
  const { data: members } = await admin.from('profiles').select('id').in('role', ['member', 'admin']);
  if (!members || members.length === 0) return { sent: 0, skipped: 0 };

  const targets = members.filter((m) => m.id !== options?.excludeUserId);
  const results = await Promise.allSettled(targets.map((m) => sendSelfNotification(m.id, text, webUrl)));

  let sent = 0;
  let skipped = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.ok) sent++;
    else skipped++;
  }
  return { sent, skipped };
}
