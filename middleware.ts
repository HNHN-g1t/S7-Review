// Vercel のルーティングミドルウェア：確認サイト全体にパスワードをかける。
// ブラウザ標準のパスワード小窓（Basic認証）は、埋め込みのブラウザでは出ないことがあるので、
// ページの中に入力欄を出し、正しければ Cookie を渡して30日間通す。
// パスワードは Vercel の環境変数 REVIEW_PASSWORD（Secret）。未設定なら誰も通さない。
// Cookie にはパスワードそのものではなく、パスワードから作った SHA-256 を入れる。
// パスワードを変えると古い Cookie は自動で無効になる。
// ローカルの vite（npm run dev）はこのファイルを使わないので、手元の確認はこれまでどおり。
export const config = { matcher: '/:path*' };

declare const process: { env: Record<string, string | undefined> };

const COOKIE = 's7r_auth';
const LOGIN_PATH = '/__s7r_login';
const MAX_AGE = 60 * 60 * 24 * 30;

const digest = async (password: string) => {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`s7-review:${password}`)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

// 文字数が同じなら比べ終わるまでの時間が変わらないようにする
const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const readCookie = (request: Request, name: string) => {
  const raw = request.headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
};

// 戻り先は同じサイトの中だけ（よそのURLへは飛ばさない）
const safeNext = (value: string | null) => (value && value.startsWith('/') && !value.startsWith('//') ? value : '/review');

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

const loginPage = (next: string, failed: boolean, status = 401) =>
  new Response(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>サイノメ確認</title><meta name="robots" content="noindex">
<style>
:root{color-scheme:light dark;--bg:#14121a;--card:#1f1c27;--text:#f2eff7;--sub:#a59fb3;--accent:#ff7fb6}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif}
form{width:min(320px,calc(100vw - 32px));background:var(--card);border-radius:14px;padding:24px;box-sizing:border-box;display:grid;gap:12px}
h1{font-size:18px;margin:0}p{margin:0;color:var(--sub);font-size:13px}
input{font:inherit;font-size:16px;padding:10px 12px;border-radius:8px;border:1px solid #4a4458;background:#110f16;color:var(--text)}
button{font:inherit;font-weight:700;padding:10px;border:0;border-radius:8px;background:var(--accent);color:#1a0d14;cursor:pointer}
.err{color:#ff8a8a}
</style></head><body>
<form method="post" action="${LOGIN_PATH}">
<h1>サイノメ確認</h1>
<p>パスワードを入れてください</p>
${failed ? '<p class="err">パスワードがちがいます</p>' : ''}
<input type="password" name="password" autocomplete="current-password" autofocus required>
<input type="hidden" name="next" value="${escapeHtml(next)}">
<button type="submit">ひらく</button>
</form></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );

export default async function middleware(request: Request) {
  const expected = process.env.REVIEW_PASSWORD;
  if (!expected) {
    return new Response('Password is not configured.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const token = await digest(expected);
  const url = new URL(request.url);

  if (url.pathname === LOGIN_PATH && request.method === 'POST') {
    const form = await request.formData();
    const next = safeNext(String(form.get('next') ?? ''));
    const given = await digest(String(form.get('password') ?? ''));
    if (!same(given, token)) return loginPage(next, true);
    return new Response(null, {
      status: 303,
      headers: {
        Location: next,
        'Set-Cookie': `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (same(readCookie(request, COOKIE), token)) return undefined; // 通す

  // ページ以外（画像・音・JS）はログイン画面を返さず断るだけ
  const wantsPage = request.method === 'GET' && (request.headers.get('accept') ?? '').includes('text/html');
  if (!wantsPage) return new Response('Authentication required.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  return loginPage(safeNext(url.pathname + url.search), false);
}
