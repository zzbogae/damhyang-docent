// 라이프로그 챗봇 중계: Gradio 두 단계 호출을 흉내 내는 가짜 챗봇으로 인자 순서·응답 꺼내기·로그인·꺼짐을 본다.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { callGradio, lifebotRelay } from '../src/mindi/lifebot-plugin';

let bot: Server;
let base = '';
const seen: { name: string; data: unknown[]; cookie?: string }[] = [];

beforeAll(async () => {
  bot = createServer(async (req, res) => {
    const url = req.url ?? '';
    if (url === '/login') { res.setHeader('Set-Cookie', 'access-token=ok; Path=/'); res.statusCode = 303; res.end(); return; }
    if (url === '/gradio_api/info') { res.end('{}'); return; }
    const m = url.match(/^\/gradio_api\/call\/(\w+)(?:\/(\w+))?$/);
    if (!m) { res.statusCode = 404; res.end(); return; }
    if (req.method === 'POST') {
      let body = '';
      for await (const c of req) body += c;
      seen.push({ name: m[1], data: JSON.parse(body).data, cookie: req.headers.cookie });
      res.end(JSON.stringify({ event_id: 'e1' }));
      return;
    }
    const out = m[1] === 'chat' ? { reply: '그 주에는 메모가 많았어요.', tools: ['메모장 9월'], focus_title: null } : '안녕하세요.';
    res.end(`event: heartbeat\ndata: null\n\nevent: complete\ndata: ${JSON.stringify([out])}\n\n`);
  }).listen(0);
  await new Promise((r) => bot.once('listening', r));
  base = `http://127.0.0.1:${(bot.address() as AddressInfo).port}`;
});
afterAll(() => bot.close());

/** 플러그인 미들웨어를 직접 불러 본다 */
async function relay(plugin: ReturnType<typeof lifebotRelay>, path: string, body?: unknown) {
  let handler: any;
  (plugin.configureServer as any)({ middlewares: { use: (_p: string, h: any) => { handler = h; } } });
  const chunks = body === undefined ? [] : [JSON.stringify(body)];
  const req: any = { method: body === undefined ? 'GET' : 'POST', url: path, [Symbol.asyncIterator]: async function* () { yield* chunks; } };
  const res: any = { statusCode: 200, headers: {}, setHeader(k: string, v: string) { this.headers[k] = v; }, end(t: string) { this.body = t; } };
  await handler(req, res);
  return { status: res.statusCode, json: JSON.parse(res.body) };
}

describe('라이프로그 챗봇 중계', () => {
  it('complete 이벤트의 첫 값을 꺼낸다', async () => {
    expect(await callGradio(base, 'greeting', ['조용한'])).toBe('안녕하세요.');
  });

  it('chat 은 message·history·focus·style 순서로 넘긴다', async () => {
    const r = await relay(lifebotRelay(base), '/chat', { message: '요즘 좀 지치네요', history: [], style: '다정한' });
    expect(r.status).toBe(200);
    expect(r.json.data.reply).toContain('메모');
    expect(seen.at(-1)).toMatchObject({ name: 'chat', data: ['요즘 좀 지치네요', [], null, '다정한'] });
  });

  it('LIFEBOT_AUTH 가 있으면 로그인 쿠키를 붙인다', async () => {
    await relay(lifebotRelay(base, 'id:pw'), '/chat', { message: '안녕', history: [], style: '조용한' });
    expect(seen.at(-1)?.cookie).toBe('access-token=ok');
  });

  it('주소가 없으면 503, 모르는 API 는 404', async () => {
    expect((await relay(lifebotRelay(undefined), '/chat', { message: 'x' })).status).toBe(503);
    expect((await relay(lifebotRelay(base), '/clusters', {})).status).toBe(404);
    expect((await relay(lifebotRelay(base), '/health')).json.ok).toBe(true);
  });
});
