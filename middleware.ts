// Vercel のルーティングミドルウェア：確認サイト全体にパスワードをかける（ブラウザ標準のBasic認証）。
// パスワードは Vercel の環境変数 REVIEW_PASSWORD に入れる。ユーザー名は何でもよい。
// 環境変数が無いときは誰も通さない（設定し忘れで丸見えにならないように）。
// ローカルの vite（npm run dev）はこのファイルを使わないので、手元の確認はこれまでどおり。
export const config = { matcher: '/:path*' };

declare const process: { env: Record<string, string | undefined> };

const REALM = 'S7-Review';

const deny = (message: string) =>
  new Response(message, {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Cache-Control': 'no-store',
    },
  });

// 文字数が同じなら比べ終わるまでの時間が変わらないようにする
const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export default function middleware(request: Request) {
  const expected = process.env.REVIEW_PASSWORD;
  if (!expected) return deny('Password is not configured.');
  const header = request.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    try {
      const bytes = Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0));
      const decoded = new TextDecoder().decode(bytes);
      const password = decoded.slice(decoded.indexOf(':') + 1);
      if (same(password, expected)) return undefined; // 通す
    } catch {
      // 壊れたヘッダーは不正として扱う
    }
  }
  return deny('Authentication required.');
}
