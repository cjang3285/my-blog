import { defineMiddleware } from 'astro:middleware';

// SSR에서는 백엔드에 직접 접근, 클라이언트에서는 미들웨어가 실행되지 않음
const API_URL = 'http://localhost:3000';

const STATIC_EXTENSIONS = /\.(css|js|mjs|json|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|map|txt|xml)$/i;

// prerender된 라우트에서는 clientAddress 접근 시 예외가 발생하므로 안전하게 조회
function safeClientAddress(context) {
  try {
    return context.clientAddress;
  } catch {
    return null;
  }
}

// nginx가 X-Forwarded-For/X-Real-IP를 $remote_addr로 덮어써서 보내므로 신뢰 가능.
// 클라이언트가 원본 요청에 직접 실어 보낸 값이 남아있을 가능성에 대비해
// 항상 마지막(가장 안쪽 프록시가 기록한) 값을 사용한다.
function getClientIp(request, clientAddress) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const parts = forwardedFor.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  return clientAddress || null;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  const { request, url } = context;
  if (
    !context.isPrerendered &&
    request.method === 'GET' &&
    !STATIC_EXTENSIONS.test(url.pathname) &&
    !url.pathname.startsWith('/_astro/')
  ) {
    const ip = getClientIp(request, safeClientAddress(context));
    const userAgent = request.headers.get('user-agent') || null;
    const referrer = request.headers.get('referer') || null;

    fetch(`${API_URL}/api/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: url.pathname, method: request.method, ip, userAgent, referrer }),
    }).catch((error) => {
      console.error('[VISIT LOG] Failed to record visit:', error);
    });
  }

  return response;
});
