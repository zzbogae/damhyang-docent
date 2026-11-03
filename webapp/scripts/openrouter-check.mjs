// OpenRouter 키 점검: 유효한지, 한도와 남은 크레딧이 얼마인지 보여 준다.
// 키는 환경변수 OPENROUTER_API_KEY 또는 webapp/.env 에서만 읽고, 화면에는 앞 10자와 끝 4자만 찍는다.
// 개인 기록은 보내지 않는다. --ping 을 붙이면 "안녕" 한 단어짜리 시험 호출을 한 번 한다(아주 적은 비용).
//   cd webapp/web && npm run key:check            # 잔액·한도
//   cd webapp/web && npm run key:check -- --ping  # + 시험 호출
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
function fromDotenv() {
  const f = path.join(root, '.env');
  if (!existsSync(f)) return undefined;
  const line = readFileSync(f, 'utf8').split('\n').find((l) => /^\s*OPENROUTER_API_KEY\s*=/.test(l));
  return line?.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '') || undefined;
}
const key = process.env.OPENROUTER_API_KEY || fromDotenv();
if (!key) {
  console.log('키 없음: webapp/.env 에 OPENROUTER_API_KEY=... 한 줄을 두거나 환경변수로 넣어 주세요.');
  process.exit(1);
}
const mask = (k) => `${k.slice(0, 10)}…${k.slice(-4)}`;
const H = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const usd = (v) => (v == null ? '없음(무제한)' : `$${Number(v).toFixed(2)}`);

console.log(`키: ${mask(key)}`);
const k = await fetch('https://openrouter.ai/api/v1/key', { headers: H });
if (!k.ok) {
  console.log(`키 확인 실패: HTTP ${k.status} (401이면 키가 틀렸거나 지워진 것)`);
  process.exit(2);
}
const d = (await k.json()).data ?? {};
const rows = [
  ['이름(label)', d.label ?? '-'],
  ['키 한도', usd(d.limit)],
  ['키 남은 한도', usd(d.limit_remaining)],
  ['한도 초기화', d.limit_reset ?? '없음'],
  ['쓴 금액(전체)', usd(d.usage)],
  ['오늘 / 이번 주 / 이번 달', [d.usage_daily, d.usage_weekly, d.usage_monthly].map(usd).join(' / ')],
  ['무료 등급', d.is_free_tier ? '예(무료 모델만, 하루 호출 제한 있음)' : '아니오'],
];
const c = await fetch('https://openrouter.ai/api/v1/credits', { headers: H });
if (c.ok) {
  const cd = (await c.json()).data ?? {};
  rows.push(['계정 크레딧 총액', usd(cd.total_credits)], ['계정 사용 총액', usd(cd.total_usage)],
    ['계정 잔액', usd((cd.total_credits ?? 0) - (cd.total_usage ?? 0))]);
} else {
  rows.push(['계정 크레딧', `조회 불가(HTTP ${c.status}, 관리 키가 아니면 정상)`]);
}
for (const [a, b] of rows) console.log(`${a.padEnd(18)} ${b}`);

if (process.argv.includes('--ping')) {
  const model = process.env.MINDI_MODEL || 'anthropic/claude-haiku-4.5';
  const t0 = Date.now();
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: H,
    body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: 'user', content: '한 단어로 인사해 줘.' }] }),
  });
  const j = await r.json().catch(() => ({}));
  console.log(`시험 호출(${model}): ${r.ok ? '성공' : `실패 HTTP ${r.status}`} · ${Date.now() - t0}ms · "${j?.choices?.[0]?.message?.content ?? j?.error?.message ?? ''}"`);
}
