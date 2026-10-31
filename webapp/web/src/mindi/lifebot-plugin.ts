// 개발·미리보기 서버 전용 중계: 브라우저 → /api/lifebot/<이름> → 라이프로그 챗봇(Gradio, 같은 서버의 127.0.0.1:7860).
// 챗봇 주소와 로그인은 서버 쪽 환경변수(LIFEBOT_URL, LIFEBOT_AUTH="아이디:비밀번호")에만 둔다.
// 챗봇을 인터넷에 직접 열지 않으려고 브라우저가 챗봇을 부르지 않게 한다(챗봇 README §5).
// 요청 본문과 응답은 기록하지 않는다.
import type { Plugin } from 'vite';

// 브라우저가 부를 수 있는 챗봇 API 와 Gradio 에 넘길 인자 순서
const ARGS: Record<string, string[]> = {
  chat: ['message', 'history', 'focus', 'style'],
  greeting: ['style'],
  island: ['history', 'style'],
  styles: [],
};

/** Gradio 두 단계 호출: event_id 를 받고, 그 id 의 이벤트 흐름에서 complete 데이터를 읽는다 */
export async function callGradio(base: string, name: string, data: unknown[], cookie = ''): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(`${base}/gradio_api/call/${name}`, { method: 'POST', headers, body: JSON.stringify({ data }) });
  if (!r.ok) throw new Error(`call ${r.status}`);
  const { event_id } = (await r.json()) as { event_id: string };
  const s = await fetch(`${base}/gradio_api/call/${name}/${event_id}`, { headers });
  const text = await s.text();
  let event = '';
  for (const line of text.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:') && event === 'complete') return (JSON.parse(line.slice(5)) as unknown[])[0];
    else if (line.startsWith('data:') && event === 'error') throw new Error('lifebot_error');
  }
  throw new Error('no_complete');
}

async function login(base: string, auth: string): Promise<string> {
  const [username, password] = [auth.slice(0, auth.indexOf(':')), auth.slice(auth.indexOf(':') + 1)];
  const r = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }).toString(),
    redirect: 'manual',
  });
  return r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

export function lifebotRelay(url?: string, auth?: string): Plugin {
  const base = url?.replace(/\/+$/, '');
  let cookie = '';
  const handler = async (req: any, res: any) => {
    res.setHeader('Content-Type', 'application/json');
    const name = String(req.url ?? '').replace(/^\/+/, '').split('?')[0];
    if (!base) { res.statusCode = 503; res.end(JSON.stringify({ error: 'no_lifebot' })); return; }
    if (name === 'health') {
      try { const r = await fetch(`${base}/gradio_api/info`, cookie ? { headers: { Cookie: cookie } } : {}); res.end(JSON.stringify({ ok: r.ok })); }
      catch { res.statusCode = 503; res.end(JSON.stringify({ ok: false })); }
      return;
    }
    if (req.method !== 'POST' || !(name in ARGS)) { res.statusCode = 404; res.end(JSON.stringify({ error: 'unknown' })); return; }
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const input = body ? JSON.parse(body) : {};
      const data = ARGS[name].map((k) => input[k] ?? null);
      if (auth && !cookie) cookie = await login(base, auth);
      let out: unknown;
      try { out = await callGradio(base, name, data, cookie); }
      catch (e) {
        if (!auth) throw e;
        cookie = await login(base, auth); // 로그인 쿠키가 만료됐으면 한 번 더
        out = await callGradio(base, name, data, cookie);
      }
      res.end(JSON.stringify({ data: out }));
    } catch {
      res.statusCode = 502; res.end(JSON.stringify({ error: 'lifebot_failed' }));
    }
  };
  return {
    name: 'lifebot-relay',
    configureServer(server) { server.middlewares.use('/api/lifebot', handler); },
    configurePreviewServer(server) { server.middlewares.use('/api/lifebot', handler); },
  };
}
