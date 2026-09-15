// 개발 서버 전용 중계: 브라우저는 판정 문장만 보내고, API 키는 서버 쪽 환경변수에만 둔다.
// 요청 본문과 응답은 기록하지 않는다.
import type { Plugin } from 'vite';

export function mindiRelay(apiKey?: string): Plugin {
  const handler = async (req: any, res: any) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        if (!apiKey) { res.statusCode = 503; res.end(JSON.stringify({ error: 'no_key' })); return; }
        let body = '';
        for await (const chunk of req) body += chunk;
        try {
          const { system, user, model } = JSON.parse(body);
          const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: model || 'anthropic/claude-haiku-4.5',
              temperature: 0.4,
              max_tokens: 400,
              messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            }),
          });
          const j: any = await r.json();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ text: j?.choices?.[0]?.message?.content ?? '' }));
        } catch (e) {
          res.statusCode = 502; res.end(JSON.stringify({ error: 'relay_failed' }));
        }
  };
  return {
    name: 'mindi-relay',
    configureServer(server) { server.middlewares.use('/api/mindi', handler); },
    configurePreviewServer(server) { server.middlewares.use('/api/mindi', handler); },
  };
}
