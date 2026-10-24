// 팀 사운드 키트(app/sound_kit_v1, PR #7 v1.3)를 웹앱에 잇는 얇은 래퍼.
// 엔진(public/sound/mined-sound.js, `npm run assets` 가 키트 폴더에서 복사)은 소리를 켠 뒤에만 불러온다.
// 지킬 것: ① 설정의 「민디 소리」가 꺼져 있으면 엔진을 불러오지도 않고 아무 소리도 내지 않는다.
// ② 소리는 사용자가 어디에 있는지(장면·지층 깊이·누른 것)에만 반응한다. 이 파일의 어떤 함수도 기록 내용을 받지 않는다.
// 화면 파일에는 sceneSound('field')·sfx('hit1')·mindiSay(문장) 같은 한 줄만 두고, 장면·효과음 대응은 아래 표에서 고친다.

/** 키트가 window.MineDSound 로 내놓는 것 중 여기서 쓰는 것 */
export interface MineDSoundKit {
  version: string;
  zones: Record<string, unknown>;
  envs: string[];
  sfxNames: string[];
  cueNames: string[];
  moods: Record<string, unknown>;
  init(opts: { base?: string; volume?: number }): MineDSoundKit;
  enable(): boolean;
  disable(): void;
  isOn(): boolean;
  setZone(id: string, opts?: { env?: string }): void;
  setDepth(d: number, sec?: number): void;
  setScene?(name: string): void;
  setEnvironment?(name: string): void;
  descend(toDepth: number, sec?: number): Promise<void>;
  overlay(kind: 'door' | 'help' | 'panel' | 'notice', open: boolean): void;
  sfx(name: string): void;
  say(text: string, opts?: { mood?: string; tone?: string }): number;
  cue(kind: string, opts?: { tone?: string }): void;
}

/** 웹앱 장면 → 키트 구역(P0~P13). 새 장면(관측소·오늘 보기·보관함·나의 공간·엘리베이터)도 미리 둔다 */
export const SCENES = {
  intro: { zone: 'P0' },          // 입장 인트로 · 안개
  import: { zone: 'P2' },         // 기록 가져오기(데이터 연결)
  observatory: { zone: 'P3' },    // 관측소 허브
  today: { zone: 'P4' },          // 오늘 보기 · 닮은 주 5개
  elevator: { zone: 'P5' },       // 내려가기
  field: { zone: 'P6' },          // 광물 지하(연도 지층). 깊이는 fieldDepth 로
  mine: { zone: 'P7' },           // 광석 캐기
  detail: { zone: 'P8' },         // 열린 광석(주 상세)
  ask: { zone: 'P9' },            // 민디와 이야기
  archive: { zone: 'P10' },       // 캔 광석 보관함
  letters: { zone: 'P10' },       // 편지(보관함과 같은 조용한 등불)
  eras: { zone: 'P10' },          // 시기
  spaceMake: { zone: 'P11' },     // 나의 공간 만들기
  space: { zone: 'P12', env: 'sea' }, // 나의 공간
  room: { zone: 'P12', env: 'room' }, // 나의 방(three.js)
  settings: { zone: 'P13' },      // 설정(겹쳐 뜨는 창이라 바탕 소리를 바꾸지 않음)
} as const satisfies Record<string, { zone: string; env?: string }>;
export type SceneName = keyof typeof SCENES;

/** 웹앱 효과음 이름 → 키트 효과음(차례로 낸다). 모든 광석은 같은 소리다 */
export const SFX = {
  tap: ['tap'], confirm: ['confirm'], back: ['back'], close: ['close'],
  door: ['door'],                 // 입장하기 · 관측소의 문
  hit1: ['pick'], hit2: ['pick'], // 곡괭이 1·2번째
  hit3: ['pick', 'ore_crack'],    // 곡괭이 3번째 → 깨짐
  card: ['card'],                 // 기록 조각 카드
  keep: ['keep'],                 // 보관함에 넣기
  nameSave: ['name_save'],        // 광석 이름 붙이기 저장
  spaceOpen: ['space_open'],      // 나의 공간 열림
  letter: ['glint'],              // 편지 열기
  floor: ['floor_tick'],          // 지층 한 해 넘김
  toggleOn: ['toggle_on'], toggleOff: ['toggle_off'],
  panelOpen: ['panel_open'], panelClose: ['panel_close'],
  step: ['step'],
  send: ['send'],
  fogClear: ['fog_clear'],
  // 10/23 버튼배치 시안의 버튼들(키트 빠짐 점검표 v3)
  locked: ['locked'], glint: ['glint'], hide: ['hide'], erase: ['erase'], memoryNote: ['memory_note'],
  shuffle: ['shuffle'], appear: ['appear'], spotlight: ['spotlight'], mindiSteps: ['mindi_steps'],
  liftStart: ['lift_start'], liftArrive: ['lift_arrive'], crack: ['ore_crack'], pick: ['pick'],
} as const satisfies Record<string, readonly string[]>;
export type SfxName = keyof typeof SFX;

/** 앱 화면(panel) → 장면. App 은 sceneSound(panelScene(panel, 주를 열었는지)) 한 줄만 부른다 */
export function panelScene(panel: string, weekOpen: boolean): SceneName {
  if (panel in SCENES) return panel as SceneName;
  if (panel === 'hub') return 'observatory';
  if (panel === 'talk') return 'ask';
  if (panel === 'collect') return 'detail';
  if (panel === 'week') return 'detail';
  if (panel === 'archive') return 'archive';
  if (panel === 'islands') return 'space';
  return weekOpen ? 'detail' : 'field';
}

const g = globalThis as unknown as { MineDSound?: MineDSoundKit; document?: Document };
let on = false;
let kit: MineDSoundKit | undefined;
let loading: Promise<MineDSoundKit | undefined> | undefined;
let scene: SceneName | undefined;   // 앱 화면이 정한 장면
let over: SceneName | undefined;    // 그 위에 겹쳐 뜬 장면(입장 인트로 등)
const current = () => over ?? scene;
let unlockArmed = false;

const base = () => {
  const b = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return b.endsWith('/') ? b : `${b}/`;
};

/** 엔진 스크립트를 한 번만 불러온다(같은 출처 정적 파일, 외부 요청 없음) */
function loadKit(): Promise<MineDSoundKit | undefined> {
  if (kit) return Promise.resolve(kit);
  if (loading) return loading;
  const doc = g.document;
  if (!doc) return Promise.resolve(undefined);
  loading = new Promise((res) => {
    const s = doc.createElement('script');
    s.src = `${base()}sound/mined-sound.js`;
    s.async = true;
    s.onload = () => { kit = g.MineDSound?.init({ base: `${base()}sound/audio/` }); res(kit); };
    s.onerror = () => { loading = undefined; res(undefined); }; // 키트가 없으면(assets 전) 내장 합성음만 쓴다
    doc.head.appendChild(s);
  });
  return loading;
}

/** 브라우저 자동재생 규칙: 첫 소리는 사용자 클릭 안에서. 저장된 「켜짐」으로 다시 열었으면 다음 클릭 때 살린다 */
function armUnlock() {
  const doc = g.document;
  if (unlockArmed || !doc) return;
  unlockArmed = true;
  const go = () => {
    unlockArmed = false;
    doc.removeEventListener('pointerdown', go, true);
    doc.removeEventListener('keydown', go, true);
    if (on && kit && !kit.isOn()) { kit.enable(); const c = current(); if (c) apply(c); }
  };
  doc.addEventListener('pointerdown', go, true);
  doc.addEventListener('keydown', go, true);
}

function apply(name: SceneName) {
  const z = SCENES[name] as { zone: string; env?: string };
  kit?.setZone(z.zone, z.env ? { env: z.env } : undefined);
}

/** 설정의 「민디 소리」와 맞춘다. 스토어가 설정을 읽거나 바꿀 때 부른다 */
export function setSoundOn(v: boolean) {
  on = v;
  if (!v) { if (kit?.isOn()) kit.disable(); return; }
  void loadKit().then((k) => {
    if (!k || !on) return;
    // 설정 화면에서 방금 켠 경우처럼 사용자 활성화가 남아 있으면 바로 켜지고, 아니면 다음 클릭 때 켠다
    if (!k.enable() || !k.isOn()) armUnlock();
    const c = current(); if (c) apply(c);
  });
  armUnlock();
}

export const soundOn = () => on;

/** 장면이 바뀔 때. 꺼져 있으면 기억만 해 두고 소리는 내지 않는다 */
export function sceneSound(name: SceneName) {
  scene = name;
  if (!over && on && kit?.isOn()) apply(name);
}

/** 앱 화면 위에 겹쳐 뜨는 장면(입장 인트로처럼). 돌려준 함수를 부르면(effect 정리) 아래 장면으로 돌아간다 */
export function sceneOverlay(name: SceneName) {
  over = name;
  if (on && kit?.isOn()) apply(name);
  return () => {
    if (over !== name) return;
    over = undefined;
    if (scene && on && kit?.isOn()) apply(scene);
  };
}

/** 광물 지하에서 지금 보이는 지층이 몇 번째 해인지(위에서부터)로만 깊이를 정한다. 그해 기록 내용은 쓰지 않는다 */
export function fieldDepth(index: number, count: number) {
  if (!on || !kit?.isOn() || count <= 0) return;
  kit.setDepth(Math.min(1, Math.max(0, index / Math.max(1, count - 1))));
}

/** 겹쳐 뜨는 창(? 안내 · 관측소의 문 · 하위 창 · 첫 대화 고지): 바탕 소리를 낮춘다 */
export function kitOverlay(kind: 'door' | 'help' | 'panel' | 'notice', open: boolean) {
  if (!on || !kit?.isOn()) return;
  kit.overlay(kind, open);
}

/** P5 엘리베이터 하강(올라갈 때는 to 를 작게). 끝나면 resolve. 꺼져 있으면 sec 만큼만 기다린다 */
export function kitDescend(to: number, sec = 2.4): Promise<void> {
  if (!on || !kit?.isOn()) return new Promise((r) => setTimeout(r, sec * 1000));
  return kit.descend(to, sec);
}

/** P3 「배경·소리 바꾸기」: lantern · rain · wind · none */
export function kitScene(name: 'lantern' | 'rain' | 'wind' | 'none') {
  if (on && kit?.isOn()) kit.setScene?.(name);
}

/** P11·P12 나의 공간 환경: sea · mountain · sky · jungle · room */
export function kitEnv(name: string) {
  if (on && kit?.isOn()) kit.setEnvironment?.(name);
}

/** 효과음 하나(표의 이름) */
export function sfx(name: SfxName) {
  if (!on || !kit?.isOn()) return;
  SFX[name].forEach((n, i) => (i ? setTimeout(() => kit?.sfx(n), 120 * i) : kit!.sfx(n)));
}

/** 민디 말풍선: 문장 길이만큼 외계어 목소리(키트 v1.3 목소리 B). 곡조는 문장 끝(? ! …) 또는 mood 로 */
export function mindiSay(text: string, mood?: string) {
  if (!on || !kit?.isOn()) return false;
  kit.say(text, mood ? { mood } : undefined);
  return true;
}

/** 민디 상황음(found·wait·mined). 키트가 켜져 있으면 키트 목소리로 내고 true, 아니면 false(호출한 쪽이 내장 합성음으로) */
export function kitCue(kind: 'found' | 'wait' | 'mined') {
  if (!on || !kit?.isOn()) return false;
  kit.cue(kind);
  return true;
}

/** 시험용: 엔진을 불러왔는지 */
export const kitLoaded = () => !!kit || !!loading;
