(function (OS) {
  'use strict';
  OS.CONFIG_DEFAULT = {
    arena: 480,
    rounds: 10,
    roundLen: 20,
    shortStart: true,
    startLens: [5, 15, 18],
    firstSpawn: 0.25,
    spawnWarn: 0.45,
    openingWave: [4, 3, 2],
    player: {
      hp: 5,
      speed: 170,
      accel: 14,
      bodyR: 10,
      dodgeDur: 0.16,
      dodgeSpeed: 500,
      dodgeInv: 0.28,
      dodgeCd: 0.55,
      hurtInv: 0.9,
      fireInt: 0.42,
      dmg: 1,
      bulletSpeed: 360,
      bulletLife: 1.2,
      bulletR: 4
    },
    spawnOld: { base: 1.05, mul: 0.88, min: 0.22, hpPerRound: true },
    enemies: {
      chase: { hp: 1, hpRound: 0.35, speed: 68 },
      shoot: { hp: 2, hpRound: 0.3, speed: 55, fireMin: 1.8, fireMax: 2.6, bulletSpeed: 130 },
      dash:  { hp: 2, hpRound: 0.35, speed: 40, tele: 0.55, dashSpeed: 400, dashTime: 0.35 },
      bomber: { hp: 1, hpRound: 0.3, speed: 78, trigger: 64, fuse: 0.9, radius: 54 },
      guard:  { hp: 4, hpRound: 0.5, speed: 34, blockCos: 0.5 },
      weights: { chase: 52, shoot: 28, dash: 20, bomber: 0, guard: 0 }
    },
    habit: { dodgePer30: 7, far: 155, close: 95, still: 0.45, moving: 0.8 },
    rival: { read: true, noise: 0.4, lateNoise: 0.05, lateFrom: 6, unfoundChance: 0.5, unfoundBonus: 0.5 },
    veto: { count: 1, enemySpeed: 1.1 },
    vetoGauge: { on: true, first: 40, growth: 1.5, max: 3 },
    adj: {
      1: true,
      2: true,
      3: true,
      4: false,
      5: false,
      6: false
    },
    enemyPick: { healEvery: 3, healHp: 2 },
    spawnNew: { base: 0.95, mul: 0.85, min: 0.17, hpGrowth: 1.1 },
    enemyHpNew: { chase: 1, shoot: 2, dash: 2, bomber: 1, guard: 3 },
    endless: { overtime: 15, bossEvery: 5, bossHpGrow: 1.5, rampFrom: 30, rampHp: 1.15, rampNum: 1.05, rampNumMax: 3 },
    boss: {
      rounds: [5, 10],
      hp: { 5: 34, 10: 78 },
      speed: 30,
      r: 30,
      ringEvery: 2.3, ringCount: 12, ringSpeed: 105,
      spiralEvery: 0.16, spiralSpeed: 120, spiralFrom: 10,
      aimedEvery: 1.3, aimedSpeed: 160,
      kinds: {},
      random: false,
      pool: ['', 'summon', 'charge', 'spiral', 'bomb'],
      summon: { fanEvery: 1.1, fanN: 5, fanSpeed: 150, callEvery: 4.5, callN: 3, speed: 42 },
      charge: { every: 2.4, tele: 0.7, speed: 480, time: 0.7, ringN: 12, ringSpeed: 115 },
      spiral: { every: 0.14, arms: 4, turn: 0.19, speed: 110, flip: 4.5, moveSpeed: 24 },
      bomb: { every: 2.0, n: 3, fuse: 1.3, spread: 90, ringN: 8, ringSpeed: 110 },
      mephy: { at: 50, againMul: 1.5, hpMul: 0.25, hpMul6: 0.2, spawnMul: 0.35, rageHp: 0.5, rageHp6: 0.25, rageAt: 120, rageMul: 0.65, gift: 1.6, giftSpeed: 135, giftFuse: 1.1, giftN: 8, giftBullet: 100 },
      spawnMul: 0.6,
      healOnKill: 1,
      vetoOnKill: 1,
      killScore: 10
    },
    quirkHeavy: {
      bounceSelfR: 6,
      slickAccel: 1.4,
      heavySpeed: 0.62,
      vampDrain: 7,
      magnetPull: 115,
      giantR: 19,
      spreadLife: 0.26,
      blastCd: 1.4,
      cannonInt: 2.4
    },
    hurtInvShort: 0.6
  };
  OS.loadConfig = function (stored) {
    const base = JSON.parse(JSON.stringify(OS.CONFIG_DEFAULT));
    if (!stored) return base;
    return deepMerge(base, stored);
  };
  OS.diffConfig = function (cfg) {
    const out = {};
    (function walk(a, d, o) {
      for (const k in a) {
        const v = a[k], dv = d ? d[k] : undefined;
        if (v && typeof v === 'object' && !Array.isArray(v) && dv && typeof dv === 'object' && !Array.isArray(dv)) {
          const sub = {}; walk(v, dv, sub); if (Object.keys(sub).length) o[k] = sub;
        } else if (JSON.stringify(v) !== JSON.stringify(dv)) o[k] = v;
      }
    })(cfg, OS.CONFIG_DEFAULT, out);
    return out;
  };
  OS.listChanges = function (diff) {
    const out = [];
    (function walk(o, d, path) {
      for (const k in o) {
        const v = o[k], dv = d ? d[k] : undefined, key = path ? path + '.' + k : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, dv, key);
        else out.push({ key, now: v, def: dv });
      }
    })(diff, OS.CONFIG_DEFAULT, '');
    return out;
  };
  function deepMerge(a, b) {
    for (const k in b) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') deepMerge(a[k], b[k]);
      else a[k] = b[k];
    }
    return a;
  }
})(globalThis.OS = globalThis.OS || {});
