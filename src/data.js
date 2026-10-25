(function (OS) {
  'use strict';
  OS.HABITS = {
    dodge:  { label: '回避が多い' },
    far:    { label: '離れて戦う' },
    close:  { label: '近づく' },
    still:  { label: '動かない' },
    moving: { label: '動き回る' }
  };
  OS.UPGRADES = {
    cannon: {
      icon: 'M12 12m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0',
      name: '大砲', plus: '威力大アップ', minus: '連射ダウン', hits: ['far'],
      mod(s, q) { s.dmg *= 3; s.fireInt *= q(2, 'cannonInt'); s.bulletR += 3; }
    },
    spread: {
      icon: 'M12 21L4 7M12 21L7.5 4.5M12 21V3M12 21l4.5-16.5M12 21l8-14',
      name: '散弾', plus: '5方向に撃つ', minus: '射程大ダウン', hits: ['far'],
      mod(s, q) { s.shots = 5; s.spreadAng = 0.26; s.bulletLife = q(0.32, 'spreadLife'); }
    },
    lunge: {
      icon: 'M3 12h13M12 6l6 6-6 6M3 7h4M3 17h4',
      name: '突撃', plus: '威力アップ', minus: '撃つたび敵へ突進', hits: ['far', 'dodge'],
      mod(s) { s.dmg *= 2; s.lunge = 230; }
    },
    bounce: {
      icon: 'M3 19L9 5l6 14 5-9M21 3v18',
      name: '跳弾', plus: '壁で2回跳ねる', minus: '跳ねた弾が自分に当たる', hits: ['still', 'close'],
      mod(s, q) { s.bounce = 2; s.bounceHurts = true; s.bounceSelfR = q(0, 'bounceSelfR'); }
    },
    heavy: {
      icon: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
      name: '重装', plus: '最大体力+2', minus: '移動速度ダウン', hits: ['moving', 'dodge'],
      hpBonus: 2,
      mod(s, q) { s.speed *= q(0.72, 'heavySpeed'); }
    },
    slick: {
      icon: 'M4 6l6 6-6 6M12 6l6 6-6 6',
      name: '加速', plus: '移動速度アップ', minus: 'すべって止まれない', hits: ['still', 'dodge'],
      mod(s, q) { s.speed *= 1.5; s.accel = q(2.4, 'slickAccel'); }
    },
    blast: {
      icon: 'M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5L19 19M19 5l-3.5 3.5M8.5 15.5L5 19',
      name: '回避爆発', plus: '回避で周りが爆発', minus: '回避の間隔アップ', hits: ['dodge'],
      mod(s, q) { s.dodgeBlastR = 78; s.dodgeBlastDmg = 3; s.dodgeCd = q(1.1, 'blastCd'); }
    },
    vamp: {
      icon: 'M12 3c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12z',
      name: '吸血', plus: '倒すと時々回復', minus: '体力が自動で減る', hits: ['still', 'far'],
      mod(s, q) { s.vampChance = 0.18; s.vampCd = 5; s.drain = q(10, 'vampDrain'); }
    },
    back: {
      icon: 'M2 12h8M6 8l-4 4 4 4M22 12h-8M18 8l4 4-4 4',
      name: '前後撃ち', plus: '連射アップ・前後に撃つ', minus: '自動で狙わない', hits: ['still', 'close'],
      mod(s) { s.fireInt *= 0.6; s.aim = false; s.backShot = true; }
    },
    giant: {
      icon: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
      name: '巨大化', plus: '弾が大きく、威力アップ', minus: '体が大きくなる', hits: ['dodge', 'close'],
      mod(s, q) { s.bulletR *= 2; s.dmg += 1; s.bodyR = q(16, 'giantR'); }
    },
    magnet: {
      icon: 'M6 3v9a6 6 0 0 0 12 0V3M6 7h3M15 7h3',
      name: '磁石', plus: '3体まで貫通', minus: '近くの敵を引き寄せる', hits: ['far'],
      mod(s, q) { s.pierce = 3; s.magnetR = 210; s.magnetPull = q(80, 'magnetPull'); }
    },
    mine: {
      icon: 'M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0M12 2v4M12 18v4M2 12h4M18 12h4',
      name: '地雷', plus: '移動中に地雷設置', minus: '連射ダウン', hits: ['still', 'far'],
      mod(s) { s.mineEvery = 0.7; s.mineDmg = 4; s.mineR = 46; s.fireInt *= 1.5; }
    },
    orbit: {
      icon: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M20 12h.01M4 12h.01',
      name: '衛星', plus: '周りを玉が2つ回る', minus: '回避すると玉が少し消える', hits: ['dodge', 'far'],
      mod(s) { s.orbitN = 2; s.orbitDist = 36; s.orbitSize = 8; s.orbitDmg = 2; s.orbitOff = 2; }
    },
    homing: {
      icon: 'M4 20C4 11 10 6 19 6M15 2l4 4-4 4',
      name: '追尾弾', plus: '弾が追尾する', minus: '弾速大ダウン', hits: ['far', 'moving'],
      mod(s) { s.homing = 4; s.bulletSpeed *= 0.5; s.bulletLife *= 1.6; }
    },
    rapid: {
      icon: 'M4 7h11M4 12h16M4 17h11M18 7h2M18 17h2',
      name: '乱射', plus: '連射大アップ', minus: '威力ダウン・狙いがぶれる', hits: ['far', 'still'],
      mod(s) { s.fireInt *= 0.4; s.dmg *= 0.5; s.jitter = 0.35; }
    },
    thorns: {
      icon: 'M12 2l2 6 6-2-2 6 4 4h-6l-4 6-4-6H2l4-4-2-6 6 2z',
      name: '反撃', plus: '被弾で周りに弾をばらまく', minus: '被弾後の無敵ダウン', hits: ['dodge', 'moving'],
      mod(s) { s.thornsN = 12; s.thornsDmg = 3; s.hurtInvMul = 0.5; }
    },
    bubble: {
      icon: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7v5l3 2',
      name: '時間の泡', plus: '近くの敵と弾が遅くなる', minus: '回避距離ダウン', hits: ['dodge', 'far'],
      mod(s) { s.slowR = 125; s.slowK = 0.45; s.dodgeSpeedMul = 0.65; }
    },
    burst: {
      icon: 'M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z',
      name: '爆裂弾', plus: '当たると爆発', minus: '近くの爆発は自分にも当たる', hits: ['close', 'still'],
      mod(s) { s.burstR = 34; s.burstDmg = 2; s.burstSelf = true; s.burstSelfR = 8; }
    },
    sniper: {
      icon: 'M12 2v5M12 17v5M2 12h5M17 12h5M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0',
      name: '狙撃', plus: '威力大アップ・弾速アップ・貫通', minus: '遠い敵を狙う・連射ダウン', hits: ['close', 'dodge'],
      mod(s) { s.targetFar = true; s.dmg *= 3; s.bulletSpeed *= 1.8; s.pierce += 1; s.fireInt *= 2.2; }
    },
    frost: {
      icon: 'M12 2v20M3.5 7l17 10M20.5 7l-17 10M9 4l3 2 3-2M9 20l3-2 3 2',
      name: '冷気', plus: '当てた敵が凍る', minus: '弾が小さく、射程ダウン', hits: ['far'],
      mod(s) { s.freeze = 1.5; s.freezeK = 0.45; s.bulletLife *= 0.6; s.bulletR *= 0.8; }
    },
    shield: {
      icon: 'M4 14a8 8 0 0 1 16 0M12 6V3M7 8L5 6M17 8l2-2',
      name: '盾', plus: '進む向きの敵の弾を防ぐ', minus: '連射ダウン', hits: ['moving', 'dodge'],
      mod(s) { s.shieldR = 26; s.shieldCos = 0.55; s.fireInt *= 1.4; }
    },
    splitter: {
      icon: 'M3 12h8M11 12l8-7M11 12h9M11 12l8 7',
      name: '分裂弾', plus: '当たると3つに分裂', minus: '分裂前の威力ダウン', hits: ['close', 'still'],
      mod(s) { s.splitN = 3; s.splitDmg = 1; s.dmg *= 0.5; }
    },
    lightning: {
      icon: 'M13 2L4 14h7l-2 8 9-12h-7z',
      name: '稲妻', plus: '2秒ごとに近くの敵へ稲妻', minus: '稲妻のあと一瞬止まる', hits: ['moving', 'dodge'],
      mod(s) { s.boltEvery = 2; s.boltN = 3; s.boltDmg = 2; s.boltStun = 0.3; }
    },
    gamble: {
      icon: 'M5 5h14v14H5zM9 9h.01M15 15h.01M12 12h.01M15 9h.01M9 15h.01',
      name: '賭け', plus: '12%で一撃（強敵には大ダメージ）', minus: '威力ダウン', hits: ['still', 'far'],
      mod(s) { s.critChance = 0.12; s.dmg *= 0.8; }
    }
  };
  OS.UNLOCKS = [
    { keys: ['sniper', 'frost'], label: 'はじめて合格する', ok: rec => rec.wins >= 1 },
    { keys: ['shield', 'splitter'], label: 'うっかりコンボを6組見つける', ok: rec => rec.combos.length >= 6 },
    { keys: ['lightning', 'gamble'], label: '本気度2で合格する', ok: rec => rec.tierCleared >= 2 }
  ];
  OS.lockedUpgrades = rec => OS.UNLOCKS.filter(u => !u.ok(rec)).flatMap(u => u.keys);
  OS.COMBOS = [
    { id: 'ranhansha', a: 'spread', b: 'bounce', name: '乱反射', desc: '跳ねた弾が自分に当たらない・射程アップ',
      mod(s) { s.bounceHurts = false; s.bulletLife = 0.6; } },
    { id: 'bousou', a: 'blast', b: 'slick', name: '暴走ダッシュ', desc: '回避の間隔大ダウン',
      mod(s) { s.dodgeCd = 0.4; } },
    { id: 'hougeki', a: 'cannon', b: 'lunge', name: '砲撃突進', desc: '手を離すと遠くまで突進・体当たりで倒せる',
      mod(s) { s.lungeIdle = true; s.lunge = 420; s.ramDmg = 4; } },
    { id: 'fujimi', a: 'vamp', b: 'heavy', name: '不死身', desc: '体力が自動で減らない・回復アップ',
      mod(s) { s.drain = 0; s.vampChance = 0.3; s.vampCd = 5; } },
    { id: 'blackhole', a: 'giant', b: 'magnet', name: 'ブラックホール', desc: '引き寄せ強化・触れた敵を吸い込む',
      mod(s) { s.magnetPull = 120; s.touchKill = true; } },
    { id: 'danmaku', a: 'back', b: 'rapid', name: '弾幕', desc: '前後左右に撃つ・連射少しダウン',
      mod(s) { s.sideShot = true; s.fireInt *= 1.4; } },
    { id: 'yudouhou', a: 'homing', b: 'cannon', name: '誘導砲', desc: '弾速そのままで追尾',
      mod(s, q, cfg) { s.bulletSpeed = cfg.player.bulletSpeed; s.homing = 6; } },
    { id: 'jiraigen', a: 'mine', b: 'slick', name: '地雷原', desc: '地雷が倍増・爆発が大きくなる',
      mod(s) { s.mineEvery *= 0.5; s.mineR *= 1.4; } },
    { id: 'wakusei', a: 'orbit', b: 'giant', name: '惑星', desc: '玉が4つ・大きくなる',
      mod(s) { s.orbitN = 4; s.orbitSize *= 1.6; s.orbitDist = 44; } },
    { id: 'harinezumi', a: 'thorns', b: 'heavy', name: 'ハリネズミ', desc: 'ばらまく弾が倍増・無敵が元に戻る',
      mod(s) { s.thornsN = 24; s.hurtInvMul = 1; } },
    { id: 'jigen', a: 'burst', b: 'bubble', name: '時限爆弾', desc: '爆発が大きく、自分に当たらない',
      mod(s) { s.burstR *= 1.5; s.burstSelf = false; } },
    { id: 'kushizashi', a: 'sniper', b: 'magnet', name: '串刺し', desc: '近い敵を狙う・何体でも貫通・連射アップ',
      mod(s) { s.pierce = 99; s.targetFar = false; s.fireInt *= 0.6; } },
    { id: 'zettaireido', a: 'frost', b: 'bubble', name: '絶対零度', desc: '泡の中がもっと遅くなる・凍る時間アップ',
      mod(s) { s.slowK = 0.25; s.freeze *= 1.5; } },
    { id: 'totsugekitate', a: 'shield', b: 'lunge', name: '突撃盾', desc: '手を離すと突進・体当たりで倒せる',
      mod(s) { s.lungeIdle = true; s.ramDmg = 3; } },
    { id: 'zerokyori', a: 'spread', b: 'lunge', name: 'ゼロ距離散弾', desc: '手を離すと突進・突進中は無敵',
      mod(s) { s.lungeIdle = true; s.ramDmg = 3; s.lungeInv = 0.22; } },
    { id: 'hanabi', a: 'splitter', b: 'spread', name: '花火', desc: '5つに分裂・射程アップ',
      mod(s) { s.splitN = 5; s.bulletLife = Math.max(s.bulletLife, 0.5); } },
    { id: 'raiu', a: 'lightning', b: 'rapid', name: '雷雨', desc: '稲妻が倍増・止まらない',
      mod(s) { s.boltEvery *= 0.5; s.boltStun = 0; } },
    { id: 'ooatari', a: 'gamble', b: 'vamp', name: '大当たり', desc: '一撃で倒すと回復',
      mod(s) { s.critHeal = true; } },
    { id: 'teppeki', a: 'shield', b: 'thorns', name: '鉄壁', desc: '盾で防ぐと周りに弾をばらまく',
      mod(s) { s.blockThorns = 4; } },
    { id: 'pinball', a: 'bounce', b: 'homing', name: 'ピンボール', desc: '3回跳ねる・自分に当たらない',
      mod(s) { s.bounce = 3; s.bounceHurts = false; } }
  ];
  OS.BOSS_NAMES = { '': 'ゴツノ', summon: 'フーモリ', charge: 'キバー', spiral: 'メーダ', bomb: 'カボー', mephy: 'メフィー' };
  OS.ENEMIES = {
    chase: { name: 'プルー', ai: 'chase', r: 11, color: '#e8654f', from: 1 },
    shoot: { name: 'ピカ', ai: 'shoot', r: 11, color: '#afa9ec', from: 2 },
    dash:  { name: 'ブーン', ai: 'dash',  r: 13, color: '#5dcaa5', from: 3 },
    mini:  { name: 'ミニプルー', ai: 'chase', r: 7, color: '#f0997b', from: 99 },
    bomber: { name: 'ドカン', ai: 'bomber', r: 11, color: '#e8a04f', from: 3 },
    guard: { name: 'カッチン', ai: 'guard', r: 14, color: '#c9b98a', from: 3 },
    boss:  { name: '強敵', ai: 'boss', r: 30, color: '#d4537e', from: 99 }
  };
  OS.ZUKAN_ENEMIES = [
    { k: 'chase', art: 'chase1', desc: 'あたしの一番の下っ端。まっすぐ追いかけてくるだけだから、ぶつからなきゃ平気よ。' },
    { k: 'mini', art: 'chase1', desc: '「プルーが分裂」を選んだら、プルーを倒すと2つに分かれるの。小さいからって油断しないでよね。' },
    { k: 'shoot', art: 'shoot1', desc: '遠くからあんたを狙って撃つの。ぼーっと止まってたら当たるわよ。' },
    { k: 'dash', art: 'dash1', desc: '光ったら一直線に突っ込んでくるわ。横によけなさい。……それくらい分かるでしょ。' },
    { k: 'bomber', art: 'bomber1', desc: '近くまで来て、ドカンってなるの。爆発する前に倒しちゃえば平気よ。' },
    { k: 'guard', art: 'guard1', desc: '正面の弾はぜんぶ防いじゃうの。カチカチなんだから。回り込んで撃ちなさい。' },
    { boss: '', art: 'boss1', desc: 'あたしの屋敷の力持ち。体のまわりが光ったら、輪みたいに弾を撃ってくるわよ。' },
    { boss: 'summon', art: 'summon1', desc: 'あんたのまわりをぐるぐる回って、扇みたいに撃つの。プルーも呼んでくるから、さっさと倒しなさい。' },
    { boss: 'charge', art: 'rush1', desc: '赤い帯が出たら、その向きに突っ込んでくるわ。帯から横に逃げて。止まったところで輪に撃つから、気を抜かないでよ。' },
    { boss: 'spiral', art: 'orb1', desc: '真ん中でくるくる回って、渦巻きに撃つの。ちょっと止まったら、回る向きが変わる合図よ。' },
    { boss: 'bomb', art: 'mortar1', desc: 'あんたの足元に爆弾を落とすの。円がいっぱいになったら弾が飛び散るから、早めにどきなさい。' },
    { boss: 'mephy', art: 'mephy1', desc: '……あたしよ。ここまで来るなんて、やるじゃない。プレゼント、ちゃんと受け取りなさいよね。本気度6か、2回目からは……本気、出してあげる。' }
  ];
  OS.TIERS = [
    { label: '被弾後の無敵が短い・ドカンが出る', apply(c) { c.adj[6] = true; c.enemies.weights.bomber = 14; } },
    { label: '回復の候補が出ない', apply(c) { c.enemyPick.healEvery = 999; } },
    { label: 'はじめの体力 −1・カッチンが出る', apply(c) { c.player.hp -= 1; c.enemies.weights.guard = 8; } },
    { label: '強敵が強く、毎回ちがう強敵が出る（体力1.25倍）', apply(c) { for (const k in c.boss.hp) c.boss.hp[k] *= 1.25; c.boss.random = true; } },
    { label: '癖の損が重い', apply(c) { c.adj[4] = true; } },
    { label: 'メフィーがうっかりコンボを避ける', apply(c) { c.rival.avoidCombo = true; } }
  ];
  OS.applyTier = function (cfg, n) {
    for (let i = 0; i < Math.min(n, OS.TIERS.length); i++) OS.TIERS[i].apply(cfg);
    cfg.tier = n;
    return cfg;
  };
  OS.ENEMY_BUFFS = [
    { id: 'fast',  name: '敵が速くなる', desc: '速さ +10%', apply(m) { m.eSpd *= 1.1; } },
    { id: 'many',  name: '敵が増える',       desc: '数 +20%', apply(m) { m.eNum *= 1.2; } },
    { id: 'tough', name: '敵が硬くなる',     desc: '体力 +20%', apply(m) { m.eHp *= 1.2; } },
    { id: 'bfast', name: '敵の弾が速い', desc: '弾速 +20%', from: 2, apply(m) { m.eBul *= 1.2; } },
    { id: 'rapid', name: 'ピカが早撃ち', desc: '連射 +25%', from: 2, apply(m) { m.shootRate *= 1.25; } },
    { id: 'gunny', name: 'ピカが増える',     desc: '出る割合アップ', from: 2, endlessW: 0.3, apply(m) { m.w.shoot += 18; } },
    { id: 'sharp', name: '突進が鋭い',   desc: '予兆 −25%', from: 3, ok: (m, run, r) => r <= run.rounds && m.tele > 0.43, apply(m) { m.tele *= 0.75; } },
    { id: 'split', name: 'プルーが分裂', desc: '倒すと2体に', from: 2, once: true, apply(m) { m.split = true; } },
    { id: 'long',  name: 'フェーズ延長', desc: '次だけ +5秒', from: 2, endlessW: 0.3, apply(m, run) { run.nextLenAdd = 5; } }
  ];
  OS.HEAL_OPTION = { id: 'heal', name: '体力を回復', desc: '+2・敵も強化' };
  OS.DEBUFFS = [
    { id: 'slow',  name: '敵の足を遅く',     desc: '速さ −15%', apply(m) { m.eSpd *= 0.85; } },
    { id: 'few',   name: '敵を減らす',   desc: '数 −20%', apply(m) { m.eNum *= 0.8; } },
    { id: 'bslow', name: '敵の弾を遅く',     desc: '弾速 −25%', apply(m) { m.eBul *= 0.75; } },
    { id: 'frail', name: '敵を脆く',         desc: '体力 −20%', apply(m) { m.eHp *= 0.8; } },
    { id: 'heal',  name: '体力を回復',       desc: '体力 +2', apply(m, run) { run.hp = Math.min(run.maxHp, run.hp + 2); } },
    { id: 'short', name: 'フェーズ短縮', desc: '次だけ 長さ2/3', apply(m, run) { run.nextLenMul = 2 / 3; } }
  ];
  OS.CREDITS = [['制作', 'こめ'], ['絵', 'Gemini'], ['音楽', 'Suno'], ['プログラム', 'Claude']];
  OS.RIVAL_NAME = 'メフィー';
  OS.EXTRAS = {
    x_rate:  { name: '連射', plus: '連射+10%', icon: 'M4 7h11M4 12h16M4 17h11', mod(s) { s.fireInt /= 1.1; } },
    x_dmg:   { name: '威力', plus: '威力+10%', icon: 'M12 3l3 6 6 1-4.5 4.5L18 21l-6-3-6 3 1.5-6.5L3 10l6-1z', mod(s) { s.dmg *= 1.1; } },
    x_speed: { name: '足の速さ', plus: '移動速度+10%', icon: 'M4 6l6 6-6 6M12 6l6 6-6 6', mod(s) { s.speed *= 1.1; } },
    x_dodge: { name: '回避', plus: '回避の間隔−10%', icon: 'M12 3a9 9 0 1 0 9 9M12 7v5l3 2', mod(s) { s.dodgeCd *= 0.9; } },
    x_size:  { name: '弾サイズ', plus: '弾の大きさ+10%', icon: 'M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0', mod(s) { s.bulletR *= 1.1; } },
    x_range: { name: '射程', plus: '射程+10%', icon: 'M3 12h15M14 7l5 5-5 5', mod(s) { s.bulletLife *= 1.1; } },
    x_hp:    { name: '最大体力', plus: '最大体力+1', icon: 'M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11z', hpBonus: 1, mod() {} }
  };
  for (const k in OS.EXTRAS) Object.assign(OS.EXTRAS[k], { minus: '', hits: [], extra: true });
  const T = n => ({ 1: 'ちょっと本気', 2: 'わりと本気', 3: 'かなり本気', 4: 'すごく本気', 5: 'ほぼ全力', 6: '手加減なし' }[n]);
  const endlessAt = n => c => (c.run && c.run.endless && c.ev === 'round' && c.run.round >= n) || c.rec.endlessBest.round > n;
  OS.ACHIEVEMENTS = [
    { id: 'win', cat: '合格', name: 'はじめての合格', desc: '10フェーズを乗り切って合格する', test: c => c.rec.wins >= 1 },
    ...[1, 2, 3, 4, 5, 6].map(n => ({ id: 'tier' + n, cat: '合格', name: T(n), desc: `本気度${n}で合格する`, test: c => c.rec.tierCleared >= n })),
    { id: 'noveto', cat: '合格', name: '受け取り上手', desc: '突き返しを使わずに合格する', test: c => c.ev === 'end' && c.win && c.run.vetoUsed === 0 },
    { id: 'close', cat: '合格', name: 'ぎりぎりセーフ', desc: '体力1で合格する', test: c => c.ev === 'end' && c.win && c.run.hp === 1 },
    { id: 'nohit', cat: '腕前', name: '指一本ふれさせない', desc: '一度も被弾せずにフェーズ5を終える', test: c => c.ev === 'round' && c.run.round >= 5 && c.run.hurtN === 0 },
    { id: 'e15', cat: 'エンドレス', name: 'おかわり', desc: 'エンドレスでフェーズ15を終える', test: endlessAt(15) },
    { id: 'e20', cat: 'エンドレス', name: 'まだ帰らない', desc: 'エンドレスでフェーズ20を終える', test: endlessAt(20) },
    { id: 'e30', cat: 'エンドレス', name: '夜ふかし', desc: 'エンドレスでフェーズ30を終える', test: endlessAt(30) },
    { id: 'e40', cat: 'エンドレス', name: '朝まで', desc: 'エンドレスでフェーズ40を終える', test: endlessAt(40) },
    { id: 'c1', cat: 'コンボ', name: 'うっかり発見', desc: 'うっかりコンボを1つ見つける', test: c => c.rec.combos.length >= 1 },
    { id: 'c10', cat: 'コンボ', name: 'うっかり収集家', desc: 'うっかりコンボを10組見つける', test: c => c.rec.combos.length >= 10 },
    { id: 'c20', cat: 'コンボ', name: 'うっかり全集', desc: 'うっかりコンボを20組すべて見つける', test: c => c.rec.combos.length >= OS.COMBOS.length },
    { id: 'r3', cat: 'コンボ', name: 'うっかり三昧', desc: '1回の挑戦でうっかりコンボを3つ', test: c => !!c.run && c.run.combos.length >= 3 },
    { id: 'r5', cat: 'コンボ', name: 'うっかりしすぎ', desc: '1回の挑戦でうっかりコンボを5つ', test: c => !!c.run && c.run.combos.length >= 5 },
    { id: 'seen', cat: '押し付け', name: '強化を知りつくす', desc: 'すべての強化に出会う', test: c => Object.keys(OS.UPGRADES).every(k => c.rec.seen.includes(k)) },
    { id: 'allup', cat: '押し付け', name: '全部受け取った', desc: '1回の挑戦で、強化をすべて押し付けられる（候補が全部そろってから）', test: c => !!c.run && Object.keys(OS.UPGRADES).every(k => c.run.ups.includes(k)) },
    { id: 'x10', cat: '押し付け', name: 'おまけ好き', desc: '1回の挑戦でおまけを10個受け取る', test: c => !!c.run && c.run.extraN >= 10 },
    { id: 'm5', cat: '腕前', name: '芋づる式', desc: 'いっぺんに5体倒す', test: c => c.multi >= 5 },
    { id: 'm10', cat: '腕前', name: '一網打尽', desc: 'いっぺんに10体倒す', test: c => c.multi >= 10 },
    { id: 'boss', cat: '腕前', name: '大物食い', desc: '強敵を倒す', test: c => c.rec.bossKills >= 1 },
    { id: 'boss10', cat: '腕前', name: '召使い泣かせ', desc: '強敵を合計10体倒す', test: c => c.rec.bossKills >= 10 },
    { id: 'zukanE', cat: '腕前', name: '顔なじみ', desc: '図鑑の敵と強敵をすべて倒す', test: c => OS.ZUKAN_ENEMIES.filter(z => z.boss !== 'mephy').every(z => z.k ? (c.rec.enemyKills || {})[z.k] > 0 : (c.rec.bossBy || {})[z.boss] > 0) },
    { id: 'mephy', cat: 'エンドレス', secret: true, name: 'メフィーに勝った', desc: 'フェーズ50のメフィーを倒す', test: c => (c.rec.mephyKills || 0) >= 1 },
    { id: 'mephy6', cat: 'エンドレス', secret: true, name: '本気のメフィーに勝った', desc: '本気度6で、フェーズ50のメフィーを倒す', test: c => (c.rec.mephy6 || 0) >= 1 },
    { id: 'k1000', cat: '腕前', name: '千客万来', desc: '1回の挑戦で1000体倒す', test: c => (!!c.run && c.run.kills >= 1000) || c.rec.best >= 1000 },
    { id: 'ktotal', cat: '腕前', name: '一騎当万', desc: '合計で1万体倒す', test: c => c.rec.totalKills >= 10000 },
    { id: 'runs50', cat: '腕前', name: 'お得意さま', desc: '50回遊ぶ', test: c => c.rec.runs >= 50 }
  ];
  OS.LINES = {
    title: ['あたしは{rival}。強化はあたしが選んであげる。あんたの癖、ちゃんと見てるから。', 'また来たの？ ……べ、別に待ってないけど。', '強くなりたいんでしょ？ だったら、あたしに任せなさい。'],
    thinking: ['ちょっと待って、今選んでるから。', '……どれがいいかな。べ、別に悩んでないし。', '急かさないでよ。', 'ふーん、こういうのもアリかも……。'],
    first: ['はい、「{up}」。文句は聞かないから。……黙って強くなりなさいよっ！'],
    habit: {
      dodge:  ['避けてばっかりじゃない。だから「{up}」。使いこなせないなら、それはあんたが弱いだけ。', 'ぴょんぴょん避けるの、見てたわよ。「{up}」で鍛えてあげる。', 'そんなに避けたいの？ 「{up}」にしたから。……甘やかさないからね。'],
      far:    ['遠くから撃ってばっかり。だから「{up}」。ほら、受け取りなさい。', '安全なところにいれば平気だと思った？ 「{up}」よ。', '離れてばっかりなの、バレてるから。「{up}」で直しなさいよ。'],
      close:  ['近づくの好きよね。だから「{up}」。……心配とかしてないけど。', 'くっつきすぎ。「{up}」あげるから、ちょっとは考えなさい。', 'そんなに近くがいいなら「{up}」。使いこなしてみせてよ。'],
      still:  ['あんまり動かないのね。だから「{up}」。ほら、動きなさいよ。', 'じっとしてるの、ちゃんと見てたから。「{up}」よ。', '動かないなら、これは困るでしょ。「{up}」。……困っても知らないから。'],
      moving: ['ずっと動き回ってるじゃない。だから「{up}」。', '落ち着きないわね。「{up}」で少しは止まりなさい。', 'ちょこまかしてたの、見てたわよ。「{up}」。……べ、別にずっと見てたわけじゃないし。']
    },
    none: ['はい、これ。「{up}」。……べ、別に選ぶのに時間かかってないから。', 'あんたの癖、今回は読みにくかったわね。じゃあ「{up}」。', '読めないなら、あたしの好みで。「{up}」よ。'],
    late: ['ここからは手加減しないから。', 'そろそろ本気、出してあげる。', 'ついてきなさいよね。'],
    inHurt: ['ちょっと！', '何当たってんの。', 'もう……。', '見てらんない。'],
    inGraze: ['……やるじゃない。', 'ふん、まぐれでしょ。', '今のはまあまあ。'],
    inMulti: ['ちょ、倒しすぎ……。', 'へえ、やるじゃない。', 'べ、別に驚いてないし。'],
    inLow: ['あと1つよ！ しっかりして。', '……ここで倒れたら許さないから。'],
    vetoGain: ['……突き返す気でしょ。わかってるんだから。', '倒しすぎ。……まあ、いいけど。', 'ふん、生意気になってきたわね。'],
    veto: ['拒否権なんてないんだからね！ 罰として敵を速くしたから。代わりに「{up}」。', 'は？ いらないの？ ……敵を速くしといた。じゃあ「{up}」。', 'わがままね。敵を速くして、「{up}」にしてあげる。感謝しなさいよ。'],
    combo: ['え、ちょ、そんなつもりじゃ……。', '……ふ、ふん。計算どおりだし。', 'な、なんで喜んでんのよ。', '待って、今のなし！ なしだから！'],
    enemyPick: ['次はあんたが選ぶ番。敵はかならず強くなるけど、どれにする？', 'どれを選んでも敵は強くなるわよ。覚悟しなさい。', '迷ってないで、さっさと選びなさいよ。', 'ほら、選んで。全部イヤでしょ？ ふふん。'],
    debuffPick: ['次はあんたの番。敵に何してやる？'],
    boss: ['大きいの呼んどいたから。このくらい倒しなさいよ。', 'この子、ちょっと強いわよ。……負けないでよね。', 'あたしの自信作。せいぜい頑張りなさい。'],
    crit: ['必殺', '大当たり', '一撃'],
    mephyIn: ['いくわよっ！'],
    mephyIn6: ['いくわよっ！'],
    mephyRage: ['もう、怒ったんだからっ！'],
    mephySkill: ['メーダ、ちょっと借りるわね。', 'フーモリ、みんなを呼んで！', 'カボー、キバー！　本気でいくわよっ！'],
    mephyDown: ['……ふ、ふん。手加減してあげただけなんだからね。'],
    mephyDown6: ['う、うそ……本気だったのに。……ちょっとは強くなったじゃない。'],
    bossDown: ['ふーん、まあまあじゃない。……あたしの強化のおかげだけど。', 'あたしの自信作が……。ま、まあ、褒めてあげなくもないけど。', 'た、倒したの？ ……ま、当然よね。'],
    endless: ['ここまで来るなんて……。ちょっとだけ、見直した。', 'しつこいわね。……そういうの、嫌いじゃないけど。', 'あんた、どこまで行く気だったのよ。……また来なさいよね。'],
    extra: ['もう押し付けるもの、ないじゃない。……しかたないから「{up}」。', 'べ、別にサービスじゃないから。「{up}」。', '余りものよ。「{up}」でも持ってなさい。', 'まだ来るの？ ……じゃあ「{up}」。'],
    milestone: ['ここまで来たの？ ……ごほうび、あげる。', 'しつこいわね。……ごほうび、ちょっとだけよ。', 'べ、別に応援してないから。'],
    win: ['……あんたが負けたら、つまんないし。それだけ。'],
    lose: ['は？ 何負けてんの。……次はもっとマシなのあげるから。', 'もう……見てらんない。ほら、もう一回。', 'あたしの強化、使いこなせてなかったでしょ。次はちゃんとしなさいよ。', 'ふん。……別に、残念とか思ってないし。']
  };
})(globalThis.OS = globalThis.OS || {});
