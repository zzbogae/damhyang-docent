// mined-sound.js 합성 효과음을 OfflineAudioContext로 wav 렌더링 (바탕 소리 제외, 효과음 버스만)
const { chromium } = require('playwright');
const fs = require('fs');
const src = fs.readFileSync('/home/user/damhyang-docent/docs/demo/sound/mined-sound.js', 'utf8')
  .replace('sfxBus.connect(master);', 'sfxBus.connect(master); global.__sfx = sfxBus; global.__master = master;');
const NAMES = ['tap','confirm','lift_start','lift_arrive','pick','ore_crack','keep','name_save','space_open','card',
  'panel_open','floor_tick','glint','memory_note','shuffle','fog_clear','appear','spotlight','mindi_steps','send'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('about:blank');
  for (const n of NAMES) {
    const wav = await p.evaluate(async ({ src, n }) => {
      const SR = 48000, LEN = 4;
      window.AudioContext = function () { return new OfflineAudioContext(2, SR * LEN, SR); };
      try { localStorage.clear(); } catch (e) {}
      delete window.MineDSound; eval(src);
      const S = window.MineDSound; S.enable();
      const ac = window.__sfx.context;
      window.__master.disconnect(); window.__sfx.disconnect(); window.__sfx.connect(ac.destination);
      S.sfx(n);
      const buf = await ac.startRendering();
      // 16-bit wav
      const ch = [buf.getChannelData(0), buf.getChannelData(1)], N = buf.length;
      const out = new DataView(new ArrayBuffer(44 + N * 4));
      const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF'); out.setUint32(4, 36 + N * 4, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true);
      out.setUint16(20, 1, true); out.setUint16(22, 2, true); out.setUint32(24, SR, true); out.setUint32(28, SR * 4, true);
      out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, N * 4, true);
      let peak = 0;
      for (let i = 0; i < N; i++) for (let c = 0; c < 2; c++) {
        const v = Math.max(-1, Math.min(1, ch[c][i])); peak = Math.max(peak, Math.abs(v));
        out.setInt16(44 + (i * 2 + c) * 2, v * 32767, true);
      }
      let s = ''; const u = new Uint8Array(out.buffer);
      for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return { b64: btoa(s), peak };
    }, { src, n });
    fs.writeFileSync(`sfx/${n}.wav`, Buffer.from(wav.b64, 'base64'));
    console.log(n, wav.peak.toFixed(3));
  }
  await b.close();
})();
