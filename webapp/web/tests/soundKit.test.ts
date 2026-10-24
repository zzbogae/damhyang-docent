// 팀 사운드 키트 래퍼: 설정이 꺼져 있으면 엔진을 불러오지도 소리를 내지도 않고, 표의 이름은 모두 키트에 있다
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { SCENES, SFX, kitCue, kitLoaded, mindiSay, panelScene, sceneSound, sfx, soundOn, fieldDepth, type MineDSoundKit } from '../src/mindi/soundKit';

// 키트 원본(app/sound_kit_v1/mined-sound.js)을 빈 window 에서 실행해 이름 목록만 읽는다(소리는 내지 않음)
function loadKitApi(): MineDSoundKit {
  const src = fs.readFileSync(path.resolve(__dirname, '../../../app/sound_kit_v1/mined-sound.js'), 'utf8');
  const win: Record<string, unknown> = {};
  vm.runInNewContext(src, { window: win, setTimeout, clearTimeout });
  return win.MineDSound as MineDSoundKit;
}

describe('사운드 키트 래퍼', () => {
  it('설정이 꺼져 있으면 엔진을 불러오지 않고 아무것도 내지 않는다', () => {
    expect(soundOn()).toBe(false);
    sceneSound('field');
    sfx('hit3');
    fieldDepth(2, 10);
    expect(mindiSay('그 무렵 이야기, 들어볼까요?')).toBe(false);
    expect(kitCue('mined')).toBe(false);
    expect(kitLoaded()).toBe(false);
  });

  it('장면·효과음 표의 이름이 모두 키트에 있다', () => {
    const kit = loadKitApi();
    expect(kit.version).toMatch(/^1\./);
    for (const [name, z] of Object.entries(SCENES)) {
      expect(kit.zones, name).toHaveProperty(z.zone);
      if ('env' in z) expect(kit.envs, name).toContain(z.env);
    }
    for (const [name, list] of Object.entries(SFX)) for (const n of list) expect(kit.sfxNames, name).toContain(n);
    for (const c of ['found', 'wait', 'mined']) expect(kit.cueNames).toContain(c);
    expect(Object.keys(kit.moods)).toContain('hello');
  });

  it('새 장면(관측소·오늘 보기·보관함·나의 공간·엘리베이터)이 표에 있고, 앱 화면은 장면으로 바뀐다', () => {
    for (const s of ['observatory', 'today', 'archive', 'space', 'elevator'] as const) expect(SCENES[s]).toBeDefined();
    expect(panelScene('week', false)).toBe('field');
    expect(panelScene('week', true)).toBe('detail');
    expect(panelScene('letters', false)).toBe('letters');
    expect(panelScene('collect', false)).toBe('detail');
  });
});
