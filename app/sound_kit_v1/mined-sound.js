/* Mine D 사운드 키트 v1 (2026-10-23)
 *
 * 한 파일, 의존성 없음. <script src="mined-sound.js"></script> 로 넣으면 window.MineDSound 가 생긴다.
 *
 * 지킬 것 한 가지: 소리는 사용자가 「어디에 있는지」에만 반응한다.
 *   기록 내용(힘들었던 주, 광석 종류·등급, 지표 방향)에 따라 소리를 바꾸는 코드를 넣지 않는다.
 *   그래서 이 파일의 어떤 함수도 기록 데이터를 인자로 받지 않는다.
 *
 * 세 층 (사운드 설계 v1 §1)
 *   A. 환경음  — 구역별 바탕 소리 + 깊이(depth 0~1) 한 값으로 음량·먹먹함·울림 조절
 *   B. 민디 보이스 — 뜻 없는 음절 합성 (기본 10 · 끝맺음 3 · 맞장구 4 · 상황음 5 = 22종)
 *   C. 음악   — 아직 트랙 없음. 지금은 A층의 낮은 패드가 대신한다 (확인 필요)
 *
 * 소리 출처
 *   - 합성: 이 파일 안에서 Web Audio 로 만든다. 외부 음원 없음.
 *     민디 상황음 found·wait·mined 는 웹앱 webapp/web/src/mindi/sound.ts 값을 그대로 옮겼고,
 *     옹알이 음색은 v5 웹 데모(start.html) blip 을 바탕으로 난수를 뺐다.
 *   - 파일: audio/*.wav 는 10/3 섬 영상(MineD_video_results_v1 C02·C03·C04·C05) 원음에서 잘라 만들었다.
 *     파일을 못 불러와도 합성음으로 대신하므로 페이지는 그대로 돈다.
 */
(function (global) {
  'use strict';

  var STORE_KEY = 'mined.sound.on';

  // ── 구역 정의 ─────────────────────────────────────────────
  // layers: 레이어 이름 → 목표 음량(0~1). depth: 그 구역의 기본 깊이. depthDriven: 깊이로 레이어가 바뀌는 구역
  var ZONES = {
    P0: { name: '첫 화면 · 안개', depth: 0, layers: { wind: 0.55, pad: 0.22 } },
    P1: { name: '로그인', depth: 0, layers: { wind: 0.32, pad: 0.16 } },
    P2: { name: '데이터 연결', depth: 0, layers: { wind: 0.32, pad: 0.16 } },
    P3: { name: '관측소', depth: 0.05, layers: { lantern: 0.4, drip: 0.25 } },
    P4: { name: '하루 고르기', depth: 0.05, layers: { lantern: 0.4, drip: 0.25 } },
    P5: { name: '엘리베이터', depth: null, depthDriven: true, layers: { lantern: 0.1 } },
    P6: { name: '연도 지층', depth: null, depthDriven: true, layers: {} },
    P7: { name: '광석 캐기', depth: null, depthDriven: true, layers: {} },
    P8: { name: '광석 상세', depth: null, depthDriven: true, scale: 0.7, layers: {} },
    P9: { name: '민디와 이야기', depth: 0.05, layers: { lantern: 0.22 } },
    P10: { name: '캔 광석 보관함', depth: 0.05, layers: { lantern: 0.3, drip: 0.15 } },
    P11: { name: '나의 공간 만들기', depth: 0, env: true, scale: 0.6, layers: {} },
    P12: { name: '나의 공간', depth: 0, env: true, layers: {} },
    P13: { name: '설정', keep: true, layers: {} } // 설정은 겹쳐 뜨는 창이라 바탕 소리를 바꾸지 않는다
  };

  // 나의 공간 환경 → 레이어 (사용자가 고른 「장소」에만 반응. 기록 내용과 무관)
  var ENVS = {
    sea: { sea: 0.9, surf: 0.25 },
    room: { room: 0.9 },
    none: {}
  };

  // 깊이 0(지상) → 1(가장 깊은 층). 사운드 설계 v1 §1-2 표 그대로
  var DEPTH = {
    gain: [1.0, 0.55],
    lowpassHz: [18000, 2500],
    reverbMix: [0.1, 0.45]
  };

  var FILES = {
    sea: 'amb_sea_waves.wav',
    room: 'amb_room_tone.wav',
    door: 'sfx_door_open.wav',
    step: 'sfx_step_wood.wav',
    step2: 'sfx_step_wood_2.wav'
  };

  // 민디 말투 4종 → 속도·음높이 고정값 (설계 v1 §1-6 rate_by_tone)
  var TONES = {
    quiet: { rate: 0.85, pitch: 0.95 },
    warm: { rate: 0.9, pitch: 1.05 },
    plain: { rate: 1.1, pitch: 1.0 },
    dry: { rate: 1.0, pitch: 0.9 }
  };

  // 민디 음절: [시작 Hz, 끝 Hz, 길이(초), 모음 색(두 번째 진동자 배수)]
  var SYL_BASE = [
    [430, 470, 0.08, 2.2], [500, 460, 0.07, 2.6], [380, 420, 0.09, 1.9], [560, 600, 0.06, 2.9], [460, 400, 0.08, 2.3],
    [520, 540, 0.07, 2.0], [400, 440, 0.08, 2.7], [590, 540, 0.06, 2.4], [450, 490, 0.09, 2.1], [480, 430, 0.07, 2.8]
  ];
  var SYL_END = {
    up: [[460, 680, 0.14, 2.3]], // ? 로 끝
    down: [[480, 340, 0.16, 2.0]], // . 로 끝
    fade: [[420, 380, 0.12, 1.9], [380, 340, 0.16, 1.8]] // … 로 끝
  };
  var SYL_REACT = {
    eung: [[420, 470, 0.11, 2.0]],
    eo: [[480, 520, 0.09, 2.6]],
    a: [[560, 500, 0.1, 2.9]],
    eum: [[380, 360, 0.18, 1.7]]
  };
  var SYL_EVENT = {
    // found·wait·mined 는 webapp/web/src/mindi/sound.ts 와 같은 값
    found: [[520, 640, 0.09, 2.1], [610, 760, 0.08, 2.6], [700, 980, 0.12, 2.3]],
    wait: [[420, 380, 0.14, 1.8], [400, 360, 0.18, 1.9]],
    mined: [[640, 900, 0.07, 2.8], [880, 1180, 0.07, 3.1], [1180, 1320, 0.16, 2.4]],
    surprise: [[600, 1000, 0.1, 2.5], [900, 860, 0.12, 2.2]],
    hello: [[480, 560, 0.08, 2.2], [560, 620, 0.08, 2.6], [620, 520, 0.14, 2.1]]
  };

  // ── 상태 ─────────────────────────────────────────────
  var ac = null, master, ambBus, ambFilter, ambGain, sfxBus, dry, wetShort, wetLong, revShort, revLong;
  var layers = {}; // name → { gain, stop }
  var buffers = {}; // file key → AudioBuffer | 'loading' | 'failed'
  var state = {
    on: false, volume: 0.8, zone: null, env: 'sea', depth: 0, moving: false,
    reduced: false, base: 'audio/', listeners: []
  };
  var dripTimer = null, lanternTimer = null, depthAnim = null;

  function readStored() {
    try { return global.localStorage.getItem(STORE_KEY) === '1'; } catch (e) { return false; }
  }
  function writeStored(v) {
    try { global.localStorage.setItem(STORE_KEY, v ? '1' : '0'); } catch (e) { /* 저장이 막혀도 동작은 같다 */ }
  }
  function emit() {
    for (var i = 0; i < state.listeners.length; i++) {
      try { state.listeners[i](snapshot()); } catch (e) { /* 화면 쪽 오류는 무시 */ }
    }
  }
  function snapshot() {
    return { on: state.on, volume: state.volume, zone: state.zone, env: state.env, depth: state.depth, moving: state.moving };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }

  // ── 오디오 그래프 ─────────────────────────────────────────
  function ensureContext() {
    if (ac) return ac;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0;
    master.connect(ac.destination);

    // 환경음: 레이어들 → ambBus → 로우패스 → 깊이 음량 → (건조 + 짧은 울림 + 긴 울림) → master
    ambBus = ac.createGain();
    ambFilter = ac.createBiquadFilter();
    ambFilter.type = 'lowpass';
    ambFilter.Q.value = 0.5;
    ambGain = ac.createGain();
    dry = ac.createGain();
    wetShort = ac.createGain();
    wetLong = ac.createGain();
    revShort = ac.createConvolver();
    revLong = ac.createConvolver();
    revShort.buffer = makeImpulse(0.4);
    revLong.buffer = makeImpulse(2.8);
    ambBus.connect(ambFilter);
    ambFilter.connect(ambGain);
    ambGain.connect(dry);
    ambGain.connect(revShort);
    ambGain.connect(revLong);
    revShort.connect(wetShort);
    revLong.connect(wetLong);
    dry.connect(master);
    wetShort.connect(master);
    wetLong.connect(master);

    // 효과음: 필터를 거치지 않는다(광석 「쨍」은 어느 깊이에서도 또렷하게). 울림만 깊이만큼 살짝 보낸다
    sfxBus = ac.createGain();
    sfxBus.connect(master);
    sfxBus.connect(revLong);

    applyDepth(state.depth, 0);
    return ac;
  }

  function makeImpulse(sec) {
    var len = Math.floor(ac.sampleRate * sec), buf = ac.createBuffer(2, len, ac.sampleRate);
    var seed = 7;
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        seed = (seed * 16807) % 2147483647; // 고정 시드: 매번 같은 울림
        d[i] = ((seed / 2147483647) * 2 - 1) * Math.pow(1 - i / len, 2.2);
      }
    }
    return buf;
  }

  var noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    var len = ac.sampleRate * 4, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    var seed = 11, b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < len; i++) { // 핑크에 가까운 잡음
      seed = (seed * 16807) % 2147483647;
      var w = (seed / 2147483647) * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048;
      d[i] = (b0 + b1 + b2 + w * 0.02) * 0.9;
    }
    noiseBuf = b;
    return b;
  }
  function noiseSource() {
    var s = ac.createBufferSource();
    s.buffer = noise();
    s.loop = true;
    return s;
  }

  // ── 레이어 (만들어 두고 음량만 올리고 내린다) ───────────────────
  var LAYER_MAKERS = {
    wind: function (out) { // 안개 바람: 잡음 + 천천히 움직이는 대역 필터
      var s = noiseSource(), bp = ac.createBiquadFilter(), lfo = ac.createOscillator(), lg = ac.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.8;
      lfo.frequency.value = 0.07; lg.gain.value = 260;
      lfo.connect(lg); lg.connect(bp.frequency);
      s.connect(bp); bp.connect(out);
      s.start(); lfo.start();
      return function () { s.stop(); lfo.stop(); };
    },
    pad: function (out) { // 낮은 패드: 선율 없는 고정 화음(늘 같은 음)
      var g = ac.createGain(), lp = ac.createBiquadFilter(), oscs = [];
      lp.type = 'lowpass'; lp.frequency.value = 700;
      g.gain.value = 0.12;
      [110, 164.81, 220.5].forEach(function (f, i) {
        var o = ac.createOscillator();
        o.type = i === 1 ? 'sine' : 'triangle';
        o.frequency.value = f;
        o.detune.value = i * 3 - 3;
        o.connect(g); o.start(); oscs.push(o);
      });
      g.connect(lp); lp.connect(out);
      return function () { oscs.forEach(function (o) { o.stop(); }); };
    },
    lantern: function (out) { // 등불: 아주 작은 불꽃 잡음 + 가끔 톡 튀는 소리
      var s = noiseSource(), hp = ac.createBiquadFilter(), g = ac.createGain();
      hp.type = 'highpass'; hp.frequency.value = 1800;
      g.gain.value = 0.18;
      s.connect(hp); hp.connect(g); g.connect(out); s.start();
      var tick = function () {
        if (!ac) return;
        var t = ac.currentTime + 0.01, b = ac.createBufferSource(), f = ac.createBiquadFilter(), e = ac.createGain();
        b.buffer = noise(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 3;
        e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.5, t + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        b.connect(f); f.connect(e); e.connect(out); b.start(t, Math.random() * 3, 0.06);
        lanternTimer = setTimeout(tick, 280 + Math.random() * 1400);
      };
      tick();
      return function () { s.stop(); clearTimeout(lanternTimer); };
    },
    drip: function (out) { // 먼 물방울: 몇 초에 한 번
      var drop = function () {
        if (!ac) return;
        var t = ac.currentTime + 0.01, o = ac.createOscillator(), e = ac.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.07);
        e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.35, t + 0.005); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        o.connect(e); e.connect(out); o.start(t); o.stop(t + 0.15);
        dripTimer = setTimeout(drop, 2200 + Math.random() * 4200);
      };
      dripTimer = setTimeout(drop, 900);
      return function () { clearTimeout(dripTimer); };
    },
    hum: function (out) { // 엘리베이터 기계음 (움직일 때만 올림)
      var g = ac.createGain(), lp = ac.createBiquadFilter(), o1 = ac.createOscillator(), o2 = ac.createOscillator(),
        s = noiseSource(), nb = ac.createBiquadFilter(), ng = ac.createGain(), trem = ac.createOscillator(), tg = ac.createGain();
      o1.type = 'sawtooth'; o1.frequency.value = 55; o2.type = 'sine'; o2.frequency.value = 110;
      lp.type = 'lowpass'; lp.frequency.value = 320;
      nb.type = 'bandpass'; nb.frequency.value = 240; nb.Q.value = 1.2; ng.gain.value = 0.5;
      trem.frequency.value = 5.5; tg.gain.value = 0.08;
      g.gain.value = 0.35;
      trem.connect(tg); tg.connect(g.gain);
      o1.connect(lp); o2.connect(lp); s.connect(nb); nb.connect(ng); ng.connect(lp); lp.connect(g); g.connect(out);
      o1.start(); o2.start(); s.start(); trem.start();
      return function () { o1.stop(); o2.stop(); s.stop(); trem.stop(); };
    },
    rumble: function (out) { // 땅속 저주파
      var s = noiseSource(), lp = ac.createBiquadFilter(), o = ac.createOscillator(), og = ac.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 90;
      o.type = 'sine'; o.frequency.value = 38; og.gain.value = 0.25;
      s.connect(lp); lp.connect(out); o.connect(og); og.connect(out);
      s.start(); o.start();
      return function () { s.stop(); o.stop(); };
    },
    surf: function (out) { // 파도 보강: 파일 반복이 들리지 않게 느린 물결 잡음을 깐다
      var s = noiseSource(), lp = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 900;
      g.gain.value = 0.5; lfo.frequency.value = 0.11; lg.gain.value = 0.45;
      lfo.connect(lg); lg.connect(g.gain);
      s.connect(lp); lp.connect(g); g.connect(out); s.start(); lfo.start();
      return function () { s.stop(); lfo.stop(); };
    },
    sea: fileLayer('sea', 'surf'),
    room: fileLayer('room', null)
  };

  function fileLayer(key, fallback) {
    return function (out) {
      var src = null, stopped = false;
      load(key).then(function (buf) {
        if (stopped || !buf) {
          if (!stopped && !buf && fallback) layerStops.push(LAYER_MAKERS[fallback](out)); // 파일이 없으면 합성으로 대신
          return;
        }
        src = ac.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(out); src.start();
      });
      var layerStops = [];
      return function () { stopped = true; if (src) src.stop(); layerStops.forEach(function (f) { f(); }); };
    };
  }

  function layer(name) {
    if (layers[name]) return layers[name];
    var g = ac.createGain();
    g.gain.value = 0;
    g.connect(ambBus);
    layers[name] = { gain: g, stop: LAYER_MAKERS[name](g) };
    return layers[name];
  }

  function load(key) {
    var b = buffers[key];
    if (b && b.then) return b;
    if (b === 'failed') return Promise.resolve(null);
    if (b) return Promise.resolve(b);
    var p = fetch(state.base + FILES[key])
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(function (ab) { return new Promise(function (res, rej) { ac.decodeAudioData(ab, res, rej); }); })
      .then(function (buf) { buffers[key] = buf; return buf; })
      .catch(function () { buffers[key] = 'failed'; return null; });
    buffers[key] = p;
    return p;
  }

  // ── 구역 · 깊이 ─────────────────────────────────────────
  function targetLevels() {
    var z = ZONES[state.zone] || {}, out = {}, k;
    for (k in z.layers) out[k] = z.layers[k];
    if (z.env) { var e = ENVS[state.env] || {}; for (k in e) out[k] = e[k]; }
    if (z.depthDriven) {
      var d = state.depth;
      out.wind = (out.wind || 0) + 0.3 * (1 - d) * (d < 0.5 ? 1 : 0.4);
      out.rumble = 0.6 * d;
      out.drip = d > 0.3 ? 0.35 : 0;
    }
    if (state.moving) out.hum = 0.7;
    var scale = (z.scale || 1) * (state.reduced ? 0.5 : 1);
    for (k in out) out[k] *= scale;
    return out;
  }

  function applyLevels(sec) {
    if (!ac) return;
    var t = ac.currentTime, target = targetLevels(), name;
    for (name in target) if (target[name] > 0) layer(name);
    for (name in layers) {
      var v = target[name] || 0, g = layers[name].gain.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(v, t + (sec == null ? 1.5 : sec));
    }
  }

  function applyDepth(d, sec) {
    if (!ac) return;
    var t = ac.currentTime, T = sec == null ? 1.5 : sec;
    var hz = DEPTH.lowpassHz[0] * Math.pow(DEPTH.lowpassHz[1] / DEPTH.lowpassHz[0], d); // 귀에 고르게 들리도록 지수 보간
    var mix = lerp(DEPTH.reverbMix[0], DEPTH.reverbMix[1], d);
    ramp(ambFilter.frequency, hz, t, T);
    ramp(ambGain.gain, lerp(DEPTH.gain[0], DEPTH.gain[1], d), t, T);
    ramp(dry.gain, 1 - mix, t, T);
    ramp(wetShort.gain, mix * (1 - d), t, T); // 얕으면 짧은 울림(0.4초), 깊으면 긴 울림(2.8초)
    ramp(wetLong.gain, mix * d, t, T);
  }
  function ramp(param, v, t, T) {
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(v, t + T);
  }

  // ── 효과음 ─────────────────────────────────────────────
  function env(t, peak, attack, decay) {
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }
  function tone(t, f0, f1, dur, type, peak, out) {
    var o = ac.createOscillator(), g = env(t, peak, 0.008, dur);
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.connect(g); g.connect(out || sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function burst(t, freq, q, dur, peak, type) {
    var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = env(t, peak, 0.002, dur);
    s.buffer = noise(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, 0.5, dur + 0.05);
  }
  function playFile(key, gain, fallback) {
    load(key).then(function (buf) {
      if (!buf) { if (fallback) fallback(); return; }
      var s = ac.createBufferSource(), g = ac.createGain();
      s.buffer = buf; g.gain.value = gain == null ? 1 : gain;
      s.connect(g); g.connect(sfxBus); s.start();
    });
  }

  var SFX = {
    tap: function (t) { tone(t, 880, 700, 0.06, 'sine', 0.12); }, // 버튼 누름 (작게)
    confirm: function (t) { tone(t, 523, 523, 0.09, 'sine', 0.14); tone(t + 0.08, 784, 784, 0.16, 'sine', 0.12); }, // 「내려간다」
    back: function (t) { tone(t, 659, 659, 0.08, 'sine', 0.12); tone(t + 0.07, 440, 440, 0.14, 'sine', 0.1); }, // 「돌아가기」
    door: function () { // 관측소의 문 · ENTER (섬 영상 C04 문 손잡이·경첩)
      playFile('door', 0.9, function () { burst(ac.currentTime, 2400, 4, 0.05, 0.4); tone(ac.currentTime + 0.1, 420, 300, 0.5, 'sawtooth', 0.04); });
    },
    lift_start: function (t) { burst(t, 120, 0.7, 0.25, 0.6, 'lowpass'); tone(t, 70, 50, 0.3, 'sine', 0.4); }, // 엘리베이터 출발 덜컹
    lift_arrive: function (t) { [1046.5, 2093, 2637].forEach(function (f, i) { tone(t, f, f, 1.2 - i * 0.3, 'sine', 0.16 / (i + 1)); }); }, // 도착 종
    pick: function (t) { burst(t, 2600, 6, 0.08, 0.5); tone(t, 190, 120, 0.12, 'triangle', 0.35); }, // 곡괭이 한 번 (캐기는 3번 호출)
    ore_crack: function (t) { // 광석 깨짐 「쨍」 — 모든 광석이 같은 소리
      burst(t, 3800, 2, 0.04, 0.6);
      [1568, 2349.3, 3136, 4186].forEach(function (f, i) { tone(t + 0.01, f, f, 1.6 - i * 0.3, 'sine', 0.22 / (i + 1)); });
    },
    keep: function (t) { tone(t, 330, 300, 0.07, 'triangle', 0.25); tone(t + 0.09, 392, 360, 0.09, 'triangle', 0.2); }, // 보관함에 넣기
    name_save: function (t) { tone(t, 784, 784, 0.12, 'sine', 0.12); tone(t + 0.1, 1175, 1175, 0.3, 'sine', 0.1); }, // 이름 붙이기 저장
    space_open: function (t) { [523, 659, 784, 1046].forEach(function (f, i) { tone(t + i * 0.12, f, f, 0.6, 'sine', 0.1); }); }, // 나의 공간 열림 (광석 3개)
    step: function () { playFile(SFX._s = SFX._s === 'step' ? 'step2' : 'step', 0.8, function () { burst(ac.currentTime, 180, 1, 0.12, 0.5, 'lowpass'); }); }, // 나의 공간 걷기 (섬 영상 C03 나무 발소리)
    toggle: function (t) { tone(t, 660, 660, 0.05, 'sine', 0.1); } // 설정 토글
  };

  // ── 민디 보이스 ─────────────────────────────────────────
  function syllables(list, t, tone_, out) {
    var tn = TONES[tone_] || TONES.quiet;
    for (var i = 0; i < list.length; i++) {
      var s = list[i], dur = s[2] / tn.rate;
      var f = ac.createBiquadFilter(), g = env(t, 0.16, 0.012, dur);
      f.type = 'bandpass'; f.frequency.value = 900 + s[3] * 220; f.Q.value = 1.6;
      [[1, 'triangle', 1], [s[3], 'sine', 0.35]].forEach(function (p) {
        var o = ac.createOscillator(), og = ac.createGain();
        o.type = p[1];
        o.frequency.setValueAtTime(s[0] * p[0] * tn.pitch, t);
        o.frequency.exponentialRampToValueAtTime(s[1] * p[0] * tn.pitch, t + dur);
        og.gain.value = p[2];
        o.connect(og); og.connect(f); o.start(t); o.stop(t + dur + 0.03);
      });
      f.connect(g); g.connect(out || sfxBus);
      t += dur + 0.035 / tn.rate;
    }
    return t;
  }

  function say(text, opts) {
    if (!ready()) return 0;
    var tone_ = (opts && opts.tone) || 'quiet';
    var clean = String(text || '').replace(/\s+/g, '');
    var n = Math.max(1, Math.min(14, Math.round(clean.length / 4.5))); // 글자 4~5개당 음절 1개
    var seq = [];
    for (var i = 0; i < n; i++) seq.push(SYL_BASE[(i * 3) % SYL_BASE.length]); // 정해진 순서. 같은 길이면 같은 소리
    var last = clean.slice(-1);
    var end = /[?？]/.test(last) ? 'up' : /…|\.\.\./.test(clean.slice(-3)) ? 'fade' : 'down';
    var t = syllables(seq, ac.currentTime + 0.02, tone_);
    syllables(SYL_END[end], t, tone_);
    return n;
  }
  function react(kind, opts) { if (ready()) syllables(SYL_REACT[kind] || SYL_REACT.eung, ac.currentTime + 0.02, (opts && opts.tone) || 'quiet'); }
  function cue(kind, opts) { if (ready()) syllables(SYL_EVENT[kind] || SYL_EVENT.found, ac.currentTime + 0.02, (opts && opts.tone) || 'plain'); }

  // ── 켜기 · 끄기 ─────────────────────────────────────────
  function ready() { return state.on && ensureContext(); }

  function enable() { // 반드시 사용자 클릭 안에서 부른다 (브라우저 자동재생 규칙)
    if (!ensureContext()) return false;
    if (ac.state === 'suspended') ac.resume();
    state.on = true; writeStored(true);
    ramp(master.gain, state.volume, ac.currentTime, 0.6);
    applyDepth(state.depth, 0);
    applyLevels(1.2);
    emit();
    return true;
  }
  function disable() {
    state.on = false; writeStored(false);
    if (ac) {
      ramp(master.gain, 0, ac.currentTime, 0.3);
      setTimeout(function () { if (!state.on && ac) ac.suspend(); }, 400);
    }
    emit();
  }

  var api = {
    version: '1.0.0',
    zones: ZONES,
    envs: Object.keys(ENVS),
    tones: Object.keys(TONES),
    sfxNames: Object.keys(SFX).filter(function (k) { return k.charAt(0) !== '_'; }),
    reactNames: Object.keys(SYL_REACT),
    cueNames: Object.keys(SYL_EVENT),

    /** 처음 한 번. base: audio 폴더 경로. 저장된 켜짐 상태는 다음 클릭 때 enable() 로 살린다 */
    init: function (opts) {
      opts = opts || {};
      if (opts.base) state.base = opts.base.replace(/\/?$/, '/');
      if (opts.volume != null) state.volume = clamp01(opts.volume);
      try { state.reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* 없음 */ }
      if (opts.reducedAudio != null) state.reduced = !!opts.reducedAudio;
      return api;
    },
    wasOn: readStored,
    enable: enable,
    disable: disable,
    toggle: function () { return state.on ? (disable(), false) : enable(); },
    isOn: function () { return state.on; },
    setVolume: function (v) { state.volume = clamp01(v); if (ac && state.on) ramp(master.gain, state.volume, ac.currentTime, 0.2); emit(); },
    /** 연출 줄이기(설정 7번)와 함께 쓰면 바탕 소리를 절반으로 */
    setReduced: function (v) { state.reduced = !!v; applyLevels(0.6); emit(); },

    /** 구역 바꾸기. id: 'P0'~'P13'. P13(설정)은 바탕 소리를 그대로 둔다 */
    setZone: function (id, opts) {
      var z = ZONES[id];
      if (!z) return;
      if (opts && opts.env) state.env = opts.env;
      if (z.keep) return;
      state.zone = id;
      if (z.depth != null) state.depth = z.depth;
      if (ac) { applyDepth(state.depth, 1.5); applyLevels(1.5); }
      emit();
    },
    /** 나의 공간 환경: 'sea' | 'room' | 'none' (사용자가 고른 장소) */
    setEnvironment: function (name) { if (ENVS[name]) { state.env = name; applyLevels(1.2); emit(); } },
    /** 깊이 0~1. 연도 지층에서 스크롤할 때 「몇 번째 층인지」로만 계산해 넘긴다 (그 해의 기록 내용 X) */
    setDepth: function (d, sec) {
      state.depth = clamp01(d);
      if (ac) { applyDepth(state.depth, sec == null ? 0.4 : sec); applyLevels(sec == null ? 0.4 : sec); }
      emit();
    },
    /** 엘리베이터: 덜컹 → 기계음 + 깊이 이동 → 도착 종. 끝나면 resolve */
    descend: function (toDepth, sec) {
      sec = sec || 3.5;
      var from = state.depth, to = clamp01(toDepth), start = null;
      if (depthAnim) cancelAnimationFrame(depthAnim);
      state.moving = true; api.sfx('lift_start'); applyLevels(0.4); emit();
      return new Promise(function (res) {
        var step = function (ts) {
          if (start == null) start = ts;
          var p = Math.min(1, (ts - start) / (sec * 1000));
          api.setDepth(lerp(from, to, p * p * (3 - 2 * p)), 0.1);
          if (p < 1) { depthAnim = requestAnimationFrame(step); return; }
          state.moving = false; applyLevels(0.8); api.sfx('lift_arrive'); emit(); res();
        };
        depthAnim = requestAnimationFrame(step);
      });
    },
    /** 효과음 하나 */
    sfx: function (name) { if (ready() && SFX[name]) SFX[name](ac.currentTime + 0.01); },
    /** 민디 말풍선: 자막 글자 수로 음절 수, 끝 글자(? . …)로 끝맺음 */
    say: say,
    /** 민디 맞장구: 'eung' | 'eo' | 'a' | 'eum' */
    react: react,
    /** 민디 상황음: 'found' | 'wait' | 'mined' | 'surprise' | 'hello' */
    cue: cue,
    state: snapshot,
    onChange: function (fn) { state.listeners.push(fn); return function () { state.listeners = state.listeners.filter(function (f) { return f !== fn; }); }; },

    /** HTML 속성만으로 붙이기
     *  data-sfx="tap"          클릭하면 효과음
     *  data-sound-zone="P3"    화면에 60% 이상 보이면 그 구역 소리로
     *  data-sound-toggle       클릭하면 소리 켜기/끄기 */
    bind: function (root) {
      root = root || global.document;
      root.addEventListener('click', function (e) {
        var el = e.target.closest && e.target.closest('[data-sfx],[data-sound-toggle]');
        if (!el) return;
        if (el.hasAttribute('data-sound-toggle')) { api.toggle(); return; }
        api.sfx(el.getAttribute('data-sfx'));
      });
      if ('IntersectionObserver' in global) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { if (en.isIntersecting) api.setZone(en.target.getAttribute('data-sound-zone')); });
        }, { threshold: 0.6 });
        root.querySelectorAll('[data-sound-zone]').forEach(function (el) { io.observe(el); });
      }
      return api;
    }
  };

  global.MineDSound = api;
})(typeof window !== 'undefined' ? window : this);
