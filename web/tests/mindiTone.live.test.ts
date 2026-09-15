// 실제 외부 모델로 말투 다듬기를 돌려 숫자 보존·금지어 검사 통과율을 잰다. LIVE=1 이고 키가 있을 때만 돈다.
// 보내는 것은 판정 문장(합성 데이터)뿐이다.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { checkTone, TONE_SYSTEM } from '../src/mindi/tone';
import { similarTemplate } from '../src/mindi/templates';

const live = process.env.LIVE === '1' && !!process.env.OPENROUTER_API_KEY;

describe.skipIf(!live)('민디 말투(실제 모델)', () => {
  it('판정 문장 말투 변환 통과율', async () => {
    const res = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../out/eval/long_result.json'), 'utf8'));
    const by = new Map(res.weeks.map((w: any) => [w.week, w]));
    const cands = res.weeks.filter((w: any) => w.candidate && w.similar?.length).slice(-15);
    const templates: string[] = [];
    for (const w of cands) {
      templates.push(w.sentence);
      const s = w.similar[0];
      templates.push(similarTemplate(w, by.get(s.week) as any, s.same_direction, 2));
    }
    let pass = 0;
    const rows: any[] = [];
    for (const t of templates) {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'anthropic/claude-haiku-4.5', temperature: 0.4, max_tokens: 400,
          messages: [{ role: 'system', content: TONE_SYSTEM }, { role: 'user', content: t }] }),
      });
      const j: any = await r.json();
      const out = String(j?.choices?.[0]?.message?.content ?? '').trim();
      const c = checkTone(t, out);
      if (c.ok) pass++;
      rows.push({ template: t, output: out, ok: c.ok, reasons: c.reasons });
    }
    fs.writeFileSync(path.resolve(__dirname, '../../out/eval/mindi_tone_live.json'), JSON.stringify({ n: templates.length, pass, rows }, null, 1));
    console.log(`tone pass ${pass}/${templates.length}`);
    expect(templates.length).toBeGreaterThan(10);
  }, 300000);
});
