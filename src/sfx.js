(function (OS) {
  'use strict';
  let ac = null, master = null, on = true;
  const last = {};
  const GAP = { shot: 0.06, hit: 0.03, kill: 0.03, tick: 0.05, pop: 0.05, block: 0.05, crit: 0.08 };
  const BUSY = { shot: 1, hit: 1, kill: 1, pop: 1, crit: 1, block: 1, bolt: 1, blast: 1, thorns: 1, drain: 1, heal: 1, warn: 1, tick: 1 };
  const BUSY_TAU = 0.5, BUSY_FROM = 15, BUSY_EXP = 0.5, BUSY_MIN = 0.35;
  let bus = null, out = null, busyN = 0, busyT = 0;
  function busyGain() {
    const rate = busyN * Math.exp(-(ac.currentTime - busyT) / BUSY_TAU) / BUSY_TAU;
    return Math.max(BUSY_MIN, rate > BUSY_FROM ? Math.pow(BUSY_FROM / rate, BUSY_EXP) : 1);
  }
  function unlock() {
    if (!ac) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC(); master = ac.createGain(); master.gain.value = OS.Sfx && OS.Sfx.silent ? 0 : 0.32; master.connect(ac.destination);
        bus = ac.createGain(); bus.connect(master);
        setInterval(() => { if (ac.state === 'running') bus.gain.setTargetAtTime(busyGain(), ac.currentTime, 0.12); }, 100);
      } catch (e) { ac = null; return; }
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
  }
  function tone(f, dur, type, vol, f2, delay) {
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || master); o.start(t); o.stop(t + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(dur, vol, freq, delay, q) {
    const t = ac.currentTime + (delay || 0);
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = q || 0.8;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out || master); s.start(t); s.stop(t + dur + 0.02);
  }
  const notes = (arr, step, type, vol) => arr.forEach((f, i) => tone(f, step * 1.6, type || 'triangle', vol || 0.12, 0, i * step));
  const SOUNDS = {
    shot()    { tone(1250, 0.035, 'square', 0.018, 900); },
    hit()     { tone(320, 0.05, 'square', 0.05, 200); },
    kill()    { tone(620, 0.07, 'triangle', 0.09, 1100); noise(0.06, 0.05, 2500); },
    hurt()    { noise(0.22, 0.32, 700); tone(190, 0.22, 'sawtooth', 0.16, 55); },
    dodge()   { noise(0.12, 0.09, 3200, 0, 2); },
    blast()   { noise(0.4, 0.38, 380); tone(110, 0.3, 'sine', 0.25, 40); },
    heal()    { notes([660, 990], 0.06, 'sine', 0.1); },
    drain()   { tone(300, 0.15, 'sine', 0.08, 200); },
    gain()    { notes([784, 988, 1319], 0.06, 'triangle', 0.1); },
    pop()     { noise(0.08, 0.07, 1800); },
    thorns()  { notes([880, 660, 440], 0.04, 'square', 0.06); },
    warn()    { tone(420, 0.05, 'square', 0.025); },
    tick()    { tone(1500, 0.025, 'square', 0.035); },
    reveal()  { notes([523, 392], 0.08, 'square', 0.06); },
    pick()    { tone(880, 0.06, 'triangle', 0.1, 1320); },
    veto()    { tone(240, 0.18, 'sawtooth', 0.09, 160); },
    combo()   { notes([523, 659, 784, 1047, 1319], 0.07, 'square', 0.07); notes([262, 330, 392, 523], 0.09, 'triangle', 0.09); },
    round()   { notes([392, 523], 0.07, 'triangle', 0.09); },
    clear()   { notes([523, 659, 784], 0.07, 'triangle', 0.1); },
    boss()    { tone(98, 0.6, 'sawtooth', 0.14, 70); tone(104, 0.6, 'sawtooth', 0.1, 74, 0.05); },
    bossDown(){ noise(0.6, 0.4, 300); notes([392, 523, 659, 784, 1047], 0.08, 'square', 0.08); },
    win()     { for (let i = 0; i < 8; i++) noise(0.05, 0.02 + i * 0.006, 2200, i * 0.045, 1.2);
                for (const f of [262, 523, 659, 784]) tone(f, 1.2, 'triangle', f < 300 ? 0.06 : 0.055, 0, 0.4);
                tone(1568, 0.4, 'sine', 0.04, 0, 0.58); tone(2093, 0.45, 'sine', 0.035, 0, 0.78); },
    lose()    { notes([392, 330, 262, 196], 0.14, 'triangle', 0.11); },
    bolt()    { noise(0.18, 0.2, 4200, 0, 0.6); tone(1800, 0.08, 'square', 0.04, 400); },
    crit()    { notes([1047, 1568], 0.05, 'square', 0.07); },
    block()   { tone(2200, 0.04, 'triangle', 0.05); },
    call()    { tone(220, 0.3, 'sawtooth', 0.06, 440); },
    deal()    { [0, 0.13, 0.26].forEach(d => noise(0.07, 0.08, 2600, d, 1.5)); },
    count()   { tone(988, 0.09, 'square', 0.07); },
    heart()   { tone(70, 0.13, 'sine', 0.4, 42); tone(64, 0.11, 'sine', 0.28, 40, 0.17); }
  };
  const SONGS = {
    normal: { bass: [57, 57, 53, 53, 48, 48, 55, 55], chords: [[69, 72, 76], [65, 69, 72], [64, 67, 72], [62, 67, 71]], lead: [76, 0, 74, 72, 0, 72, 69, 0] },
    boss:   { bass: [57, 57, 58, 58, 57, 57, 52, 52], chords: [[69, 72, 76], [70, 74, 77], [69, 72, 76], [68, 71, 76]], lead: [81, 0, 80, 0, 77, 76, 0, 74] }
  };
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  let musicOn = true, mGain = null, playing = false, song = 'normal', level = 1, step = 0, nextT = 0, timer = null;
  const STEP = 60 / 128 / 2;
  function mtone(f, t, dur, type, vol, f2) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(mGain); o.start(t); o.stop(t + dur + 0.02);
  }
  function mnoise(t, dur, vol, freq) {
    if (!noiseBuf) return;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(mGain); s.start(t); s.stop(t + dur + 0.02);
  }
  function playStep(i, t) {
    const S = SONGS[song], bar = Math.floor(i / 8) % 4, beat = i % 8;
    if (beat % 2 === 0) mtone(midi(S.bass[bar * 2 + (beat >= 4 ? 1 : 0)] - 24 + (beat % 4 === 2 ? 12 : 0)), t, STEP * 1.7, 'triangle', 0.32);
    if (beat === 0 || beat === 4) mtone(120, t, 0.14, 'sine', 0.35, 45);
    if (beat === 2 || beat === 6) mnoise(t, 0.09, 0.08, 1800);
    mnoise(t, 0.03, beat % 2 ? 0.05 : 0.025, 7000);
    if (level >= 2 && beat % 2 === 1) { const ch = S.chords[bar]; mtone(midi(ch[(i >> 1) % 3]), t, STEP * 0.9, 'square', 0.045); }
    if (level >= 3) { const n = S.lead[beat]; if (n && bar % 2 === 1) mtone(midi(n), t, STEP * 1.8, 'square', 0.04); }
  }
  function schedule() {
    if (!ac || !playing || ac.state !== 'running') return;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.3) { playStep(step, nextT); step = (step + 1) % 32; nextT += STEP; }
  }
  function synthStart(kind, lv) {
    if (!mGain) { mGain = ac.createGain(); mGain.gain.value = 0.22; mGain.connect(master); if (!noiseBuf) noise(0.001, 0.0001, 1000); }
    const same = playing && song === kind;
    song = kind; level = lv;
    if (same) return;
    playing = true; step = 0; nextT = ac.currentTime + 0.08;
    if (!timer) timer = setInterval(schedule, 70);
  }
  function synthStop() { playing = false; if (timer) { clearInterval(timer); timer = null; } }
  const TRACKS = {
    title:   { src: 'audio/bgm_title.mp3' },
    battle:  { src: 'audio/bgm_battle.mp3', keep: true },
    battle2: { src: 'audio/bgm_battle2.mp3', keep: true },
    boss:    { src: 'audio/bgm_boss.mp3' },
    endless: { src: 'audio/bgm_endless.mp3', keep: true, loop: { start: 1.80, end: 213.34, xfade: 1.58 } },
    mephy:   { src: 'audio/bgm_mephy.mp3', loop: { start: 0.673, end: 175.86, xfade: 0.4 } },
    ending:  { src: 'audio/bgm_ending.mp3' },
    win:     { src: 'audio/jingle_win.mp3' }
  };
  const FILE_VOL = 0.38, FADE = 0.45;
  const raw = {}, bufs = {}, failed = {}, pos = {}, used = [];
  let fGain = null, cur = null, want = null;
  function fetchRaw(name) {
    if (raw[name] || failed[name] || typeof fetch === 'undefined') return raw[name];
    raw[name] = fetch(TRACKS[name].src).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
    raw[name].catch(() => { failed[name] = true; });
    return raw[name];
  }
  function decode(name) {
    if (bufs[name]) return bufs[name];
    bufs[name] = fetchRaw(name).then(ab => new Promise((ok, ng) => {
      let dc = ac;
      try { const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (OAC) dc = new OAC(2, 1, 32000); } catch (e) {}
      const p = dc.decodeAudioData(ab.slice(0), ok, ng); if (p && p.catch) p.catch(ng);
    }));
    bufs[name].catch(() => { failed[name] = true; delete bufs[name]; });
    const i = used.indexOf(name); if (i >= 0) used.splice(i, 1); used.push(name);
    while (used.length > 2) {
      const old = used.find(n => n !== name && !(cur && cur.name === n)); if (!old) break;
      used.splice(used.indexOf(old), 1); delete bufs[old];
    }
    return bufs[name];
  }
  function preload(names) { for (const n of names) fetchRaw(n); }
  function soundEnd(buf) {
    if (buf._end) return buf._end;
    const d = buf.getChannelData(0), lim = 0.003;
    let i = d.length - 1; while (i > 0 && Math.abs(d[i]) < lim) i--;
    buf._end = Math.min(buf.duration, i / buf.sampleRate + 0.02);
    return buf._end;
  }
  function voice(buf, at, offset, fadeIn) {
    const src = ac.createBufferSource(), g = ac.createGain(), end = soundEnd(buf);
    src.buffer = buf; src.loop = true; src.loopStart = 0; src.loopEnd = end;
    src.connect(g); g.connect(cur.gain);
    g.gain.setValueAtTime(fadeIn ? 0.0001 : 1, at);
    if (fadeIn) g.gain.exponentialRampToValueAtTime(1, at + fadeIn);
    src.start(at, Math.min(offset, end - 0.05));
    return { src, g, at, offset, end };
  }
  function voiceLoop(c, buf, at, offset, fadeIn) {
    const L = TRACKS[c.name].loop;
    if (!L) return voice(buf, at, offset, fadeIn);
    const off = offset >= L.end - 0.05 ? L.start : offset;
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = buf; src.connect(g); g.connect(c.gain);
    g.gain.setValueAtTime(fadeIn ? 0.0001 : 1, at);
    if (fadeIn) g.gain.exponentialRampToValueAtTime(1, at + fadeIn);
    src.start(at, off);
    const nextAt = at + (L.end - off);
    const v = { src, g, at, offset: off, end: L.end, manual: true };
    v.timer = setTimeout(() => {
      if (cur !== c || c.v !== v) return;
      c.v = voiceLoop(c, buf, nextAt, L.start, L.xfade);
      g.gain.setValueAtTime(1, nextAt); g.gain.linearRampToValueAtTime(0.0001, nextAt + L.xfade);
      try { src.stop(nextAt + L.xfade + 0.05); } catch (e) {}
    }, Math.max(0, (nextAt - ac.currentTime - 0.4) * 1000));
    return v;
  }
  function where(c) {
    const t = c.v.offset + (ac.currentTime - c.v.at);
    if (c.v.manual) return Math.max(c.v.offset, Math.min(t, c.v.end));
    return Math.max(0, t) % c.v.end;
  }
  function fileStop(fade) {
    if (!cur) return;
    const c = cur; cur = null;
    if (c.buf && TRACKS[c.name].keep) pos[c.name] = where(c); else delete pos[c.name];
    const t = ac.currentTime, d = fade == null ? FADE : fade;
    c.gain.gain.cancelScheduledValues(t); c.gain.gain.setValueAtTime(Math.max(0.0001, c.gain.gain.value), t); c.gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
    if (c.v) { clearTimeout(c.v.timer); try { c.v.src.stop(t + d + 0.05); } catch (e) {} }
    setTimeout(() => { try { c.gain.disconnect(); } catch (e) {} }, (d + 0.2) * 1000);
  }
  function fileStart(name) {
    if (cur && cur.name === name) return;
    fileStop();
    if (!fGain) { fGain = ac.createGain(); fGain.gain.value = FILE_VOL; fGain.connect(master); }
    const g = ac.createGain(); g.gain.value = 1; g.connect(fGain);
    const c = cur = { name, gain: g, buf: null, v: null };
    decode(name).then(buf => {
      if (cur !== c) return;
      c.buf = buf;
      const off = pos[name] != null ? pos[name] : 0;
      c.v = voiceLoop(c, buf, ac.currentTime + 0.03, off, off > 0 ? FADE : 0.05);
    }).catch(() => { if (cur === c) { cur = null; if (want && want.name === name) musicStart(want.kind, want.lv); } });
  }
  function musicStart(kind, lv) {
    if (!ac) return;
    want = { kind, lv, name: kind === 'title' || kind === 'lose' ? 'title' : kind === 'win' ? 'win' : kind === 'endless' ? 'endless' : kind === 'mephy' ? 'mephy' : kind === 'ending' ? 'ending' : kind === 'boss' ? 'boss' : lv >= 3 ? 'battle2' : 'battle' };
    if (!on || !musicOn) { musicStop(); return; }
    if (!failed[want.name]) { synthStop(); fileStart(want.name); if (want.name === 'battle') preload(['boss', 'battle2', 'win']); if (want.name === 'win') preload(['endless']); return; }
    fileStop(0.1);
    if (kind === 'win') { SOUNDS.win(); return; }
    if (kind === 'title' || kind === 'lose' || kind === 'ending') return;
    if (kind === 'mephy') { synthStart('boss', 3); return; }
    if (kind === 'endless') { synthStart('normal', 3); return; }
    synthStart(kind, lv);
  }
  function musicStop() { want = null; synthStop(); fileStop(); }
  function duck(d) {
    if (!ac) return; const t = ac.currentTime;
    if (fGain) { fGain.gain.cancelScheduledValues(t); fGain.gain.setTargetAtTime(FILE_VOL * (d ? 0.35 : 1), t, 0.12); }
    if (mGain) { mGain.gain.cancelScheduledValues(t); mGain.gain.setTargetAtTime(0.22 * (d ? 0.35 : 1), t, 0.12); }
  }
  function musicRewind() { delete pos.battle; delete pos.battle2; delete pos.endless; delete pos.mephy; }
  OS.Sfx = {
    unlock,
    get on() { return on; },
    set on(v) { on = !!v; if (on) unlock(); else musicStop(); },
    get musicOn() { return musicOn; },
    set musicOn(v) { musicOn = !!v; if (!musicOn) musicStop(); },
    music: musicStart,
    musicStop,
    duck,
    musicRewind,
    hold(on) { if (!ac) return; try { if (on) ac.suspend(); else ac.resume(); } catch (e) {} },
    get busy() { return ac && bus ? Math.round(bus.gain.value * 100) / 100 : 1; },
    musicSeek(sec) { if (!cur || !cur.buf) return; const n = cur.name; pos[n] = sec; const k = TRACKS[n].keep; TRACKS[n].keep = true; fileStop(0.05); TRACKS[n].keep = k; pos[n] = sec; fileStart(n); },
    get musicNow() { return cur ? { name: cur.name, ready: !!cur.buf, at: cur.buf && ac ? Math.round(where(cur) * 10) / 10 : 0, failed: Object.keys(failed) } : { name: playing ? 'synth:' + song : '', failed: Object.keys(failed) }; },
    play(name) {
      if (!on || !ac || ac.state !== 'running' || !SOUNDS[name]) return;
      const now = ac.currentTime, gap = GAP[name] || 0.02;
      if (last[name] != null && now - last[name] < gap) return;
      last[name] = now;
      if (BUSY[name]) { busyN = busyN * Math.exp(-(now - busyT) / BUSY_TAU) + 1; busyT = now; }
      out = BUSY[name] ? bus : master;
      try { SOUNDS[name](); } catch (e) {}
      out = null;
    }
  };
})(globalThis.OS = globalThis.OS || {});
