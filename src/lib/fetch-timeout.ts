/**
 * 응답이 오지 않을 때를 대비한 타임아웃 fetch.
 *
 * 일반 fetch 는 서버가 응답을 안 주면 그냥 기다린다. try/catch 는 '실패'만 잡고
 * '멈춤'은 못 잡아서, 로그인 경로에서 이러면 무한 로딩으로 보인다.
 *
 * AbortSignal.timeout() 은 iOS 15 이하 사파리에 없어 그대로 쓰면 그 기기에서
 * 예외가 난다. 어디서나 되는 AbortController + setTimeout 으로 구현한다.
 *
 * 시간이 초과되면 AbortError 로 reject 되므로, 호출부의 기존 catch 가 그대로 받는다.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  ms = 5000,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
