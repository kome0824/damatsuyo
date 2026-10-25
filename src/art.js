(function (OS) {
  'use strict';
  const SPRITES = ['hero1', 'hero2', 'chase1', 'chase2', 'shoot1', 'shoot2', 'dash1', 'dash2', 'bomber1', 'bomber2', 'guard1', 'guard2',
    'boss1', 'boss2', 'boss3', 'summon1', 'summon2', 'summon3', 'rush1', 'rush2', 'rush3', 'orb1', 'orb2', 'orb3', 'mortar1', 'mortar2', 'mortar3', 'mephy1', 'mephy2', 'mephy3',
    'rival_smug', 'rival_think', 'rival_shock', 'rival_angry', 'rival_happy',
    'gift', 'gift_open', 'star', 'boom', 'heart', 'logo'];
  const BGS = ['floor', 'title'];
  const A = { img: {}, white: {}, blue: {}, bg: {}, src: n => `art/sprites/${n}.png` };
  OS.ART = A;
  if (typeof document === 'undefined') return;
  function tint(img, col) {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  for (const n of SPRITES) {
    const im = new Image();
    im.onload = () => { A.img[n] = im; try { A.white[n] = tint(im, '#ffffff'); A.blue[n] = tint(im, '#9fd3ff'); } catch (e) {} };
    im.src = A.src(n);
  }
  for (const n of BGS) { const im = new Image(); im.onload = () => { A.bg[n] = im; }; im.src = `art/bg/${n}.jpg`; }
})(globalThis.OS = globalThis.OS || {});
