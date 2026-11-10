// Package browser shared by the Fugio games (Gummy the Fisherman, Defeat the Monster): level tabs (A0 / A1 / A2),
// Grammar or Vocabulary, the numbered topics of the Czech school curriculum, a search over all of them, and ticks:
// several packages can be chosen at once and the game mixes their questions.
//   FugioPacks.open(packs, chosenIds, {theme: 'gummy' | 'dtm' | 'pixel' | 'paper'}) → Promise<array of package ids, or null when cancelled>
//   FugioPacks.sort(packs) · FugioPacks.label(pack) → "A1 · Grammar 9"
//   FugioPacks.merge(packs, ids) → one package made of the chosen ones (round 1 = all their round-1 questions, …)
//   FugioPacks.summary(packs, ids) → {title, sub, level} for the game's package button
// A package: {id, level, kind: 'Grammar'|'Vocabulary', n, title, subtitle, count, rounds}
(function () {
  const LEVELS = {
    A0: {name: 'Pre-A1', sub: 'Complete beginners · grades 1–3', c: '#5ee08a'},
    A1: {name: 'Beginner', sub: 'Grades 3–6', c: '#4fb4ff'},
    A2: {name: 'Elementary', sub: 'Grades 6–9', c: '#b57bff'},
  };
  const KINDS = ['Grammar', 'Vocabulary'];
  const MAX = 12; // more topics than this in one game would mean only one or two questions from each
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const num = (p) => (p.n % 1 ? Math.floor(p.n) + '+' : p.n);
  const sort = (packs) => packs.slice().sort((a, b) => String(a.level).localeCompare(String(b.level))
    || KINDS.indexOf(a.kind || 'Grammar') - KINDS.indexOf(b.kind || 'Grammar') || (a.n || 0) - (b.n || 0) || String(a.title).localeCompare(String(b.title)));
  const label = (p) => p ? `${p.level} · ${p.kind || 'Grammar'} ${num(p)}` : '';
  const pick = (packs, ids) => sort(packs.filter((p) => (ids || []).includes(p.id)));
  function merge(packs, ids) {
    const ps = pick(packs, ids); if (!ps.length) return null;
    if (ps.length === 1) return ps[0];
    return {id: ps.map((p) => p.id).join('+'), level: [...new Set(ps.map((p) => p.level))].join('/'), kind: 'Mix', n: 0,
      title: summary(packs, ids).title, subtitle: ps.map((p) => p.title).join(' · '), count: ps.reduce((s, p) => s + p.count, 0),
      rounds: [0, 1, 2].map((r) => ps.flatMap((p) => p.rounds[r] || [])), parts: ps.map((p) => p.id)};
  }
  function summary(packs, ids) {
    const ps = pick(packs, ids);
    if (!ps.length) return {title: 'Choose packages', sub: '', level: '–'};
    if (ps.length === 1) return {title: ps[0].title, sub: `${label(ps[0])} · ${ps[0].count} questions`, level: ps[0].level};
    const lv = [...new Set(ps.map((p) => p.level))];
    return {title: `${ps.length} packages mixed`, sub: `${ps.map((p) => p.title.split(' – ')[0]).join(', ')} · ${ps.reduce((s, p) => s + p.count, 0)} questions`, level: lv.length > 1 ? 'MIX' : lv[0]};
  }

  // ---- two looks: Gummy (see-through frosted glass over the lake, thin white edges, Nunito, as in its lobby) and Defeat the Monster (orange
  // frames with corner brackets over the ruined city, Impact tags, Exo 2)
  const THEMES = {
    gummy: `
    .fpk-ov{background:rgba(3,10,22,.38);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
    .fpk{background:rgba(8,18,36,.46);-webkit-backdrop-filter:blur(18px) saturate(1.2);backdrop-filter:blur(18px) saturate(1.2);border:1.5px solid rgba(255,255,255,.6);border-radius:28px;
      box-shadow:0 14px 40px rgba(0,0,0,.28);font-family:Nunito,system-ui,sans-serif}
    .fpk-top{border-bottom:1.5px solid rgba(255,255,255,.22)}
    .fpk-h b{font:900 clamp(26px,3.6vh,36px)/1 Nunito,sans-serif;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.35)}
    .fpk-kick{font:900 12px/1 Nunito,sans-serif;letter-spacing:.2em;color:#fff;opacity:.8}
    .fpk-x{border-radius:50%;background:rgba(8,18,36,.3);border:1.5px solid rgba(255,255,255,.6);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
    .fpk-lv button{border-radius:20px;border:1.5px solid rgba(255,255,255,.45);background:rgba(8,18,36,.22);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);transition:background .2s,border-color .2s}
    .fpk-lv button:hover{background:rgba(8,18,36,.36)}
    .fpk-lv button.on{border-color:var(--c);background:color-mix(in srgb,var(--c) 22%,rgba(8,18,36,.3))}
    .fpk-lv button b i{border-radius:9px}
    .fpk-seg{border-radius:999px;background:rgba(8,18,36,.3);border:1.5px solid rgba(255,255,255,.45);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
    .fpk-seg button{border-radius:999px}
    .fpk-seg button.on{background:linear-gradient(135deg,rgba(255,111,208,.85),rgba(139,92,255,.85))}
    .fpk-q{border-radius:999px;padding:10px 16px;border:1.5px solid rgba(255,255,255,.45);background:rgba(8,18,36,.3);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
    .fpk-q::placeholder{color:rgba(255,255,255,.65)}
    .fpk-q:focus{border-color:#fff;background:rgba(8,18,36,.42)}
    .fpk-list{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.35) transparent}
    .fpk-it{border-radius:18px;background:rgba(8,18,36,.26);border:1.5px solid rgba(255,255,255,.3)}
    .fpk-it:hover{background:rgba(8,18,36,.36);border-color:rgba(255,255,255,.6)}
    .fpk-it.on{border-color:#ff8fe0;background:linear-gradient(135deg,rgba(255,111,208,.26),rgba(139,92,255,.26))}
    .fpk-n{border-radius:12px;box-shadow:0 0 12px color-mix(in srgb,var(--c) 45%,transparent)}
    .fpk-t b{text-shadow:0 1px 6px rgba(0,0,0,.35)}
    .fpk-tick{border-radius:50%;border:1.5px solid rgba(255,255,255,.7);background:rgba(8,18,36,.25)}
    .fpk-it.on .fpk-tick{background:linear-gradient(135deg,#ff6fd0,#8b5cff);border-color:#fff}
    .fpk-tag{border-radius:999px}
    .fpk-foot{background:rgba(8,18,36,.28);border-top:1.5px solid rgba(255,255,255,.22)}
    .fpk-go{border-radius:999px;background:rgba(8,18,36,.3);border:1.5px solid #ff8fe0;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);
      font:900 18px/1 Nunito,sans-serif;box-shadow:inset 0 0 0 999px rgba(255,111,208,.22),0 0 22px rgba(255,111,208,.3);transition:transform .12s,box-shadow .2s}
    .fpk-go:hover:not(:disabled){box-shadow:inset 0 0 0 999px rgba(255,111,208,.36),0 0 28px rgba(255,111,208,.45)}
    .fpk-go:active{transform:scale(.97)}
    .fpk-go:disabled{border-color:rgba(255,255,255,.5);box-shadow:none}
    .fpk-chip{border-radius:999px;background:rgba(8,18,36,.3);border:1.5px solid rgba(255,143,224,.85)}
    .fpk-chip:hover{background:rgba(255,111,208,.25)}`,
    dtm: `
    .fpk-ov{background:rgba(4,8,20,.72)}
    .fpk{position:relative;overflow:visible;background:linear-gradient(#13213df0,#0c1830f5),url(/defeatthemonster/art/battle-city.png) 50% 50%/cover;border:3px solid #ee8a35;border-radius:20px;
      box-shadow:inset 0 0 0 2px #7c3d12,inset 0 0 40px #ee8a352b,0 24px 60px #000a;font-family:"Exo 2",system-ui,sans-serif}
    .fpk::before,.fpk::after{content:"";position:absolute;width:54px;height:54px;pointer-events:none;z-index:2;background:linear-gradient(135deg,#ffd9a6,#e27a2a 50%,#6e310c);
      clip-path:polygon(0 0,100% 0,100% 22%,30% 22%,22% 30%,22% 100%,0 100%)}
    .fpk::before{top:-3px;left:-3px} .fpk::after{right:-3px;bottom:-3px;transform:rotate(180deg)}
    .fpk>*{position:relative;z-index:1} .fpk-top{border-radius:20px 20px 0 0} .fpk-foot{border-radius:0 0 20px 20px}
    .fpk-h b{font:900 clamp(26px,3.4vh,36px)/1 Impact,"Arial Black",sans-serif;letter-spacing:1px;color:#ffd9a6;text-shadow:2px 3px 0 #080f25;text-transform:uppercase}
    .fpk-kick{display:inline-block;align-self:flex-start;padding:5px 10px;background:linear-gradient(#1d3151,#101c30);border:2px solid #385783;font:800 13px/1 Impact,"Arial Black",sans-serif;letter-spacing:1px;color:#e4ddff}
    .fpk-x{border-radius:8px;border:2px solid #ee8a35;background:#0c1830;color:#ffb357}
    .fpk-lv button{border-radius:8px;border:2px solid #36537d;background:#0c1830cc;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}
    .fpk-lv button b{font-family:Impact,"Arial Black",sans-serif;font-weight:400;letter-spacing:.5px}
    .fpk-lv button b i{border-radius:4px}
    .fpk-lv button.on{border-color:#ffb357;background:#3a2410cc;box-shadow:inset 0 0 18px #ee8a3555}
    .fpk-seg{border-radius:8px;background:#0c1830;border:2px solid #36537d}
    .fpk-seg button{border-radius:5px;font-family:"Exo 2",sans-serif}
    .fpk-seg button.on{background:linear-gradient(135deg,#5b3fd6,#40279e);box-shadow:inset 0 0 0 2px #ff9a3c}
    .fpk-q{border-radius:8px;border-color:#36537d;background:#071325}
    .fpk-q:focus{border-color:#ffb357}
    .fpk-it{border-radius:0;border:2px solid #36537d;background:#0c1830d9;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}
    .fpk-it:hover{border-color:#7399d4}
    .fpk-it.on{border-color:#ff9a3c;background:linear-gradient(135deg,#5b3fd6cc,#2e1a7ccc);box-shadow:inset 0 0 14px #ff8a2a55}
    .fpk-n{border-radius:4px;font-family:Impact,"Arial Black",sans-serif;font-weight:400}
    .fpk-t b{font-family:"Exo 2",sans-serif;font-weight:800}
    .fpk-tick{border-radius:4px;border-color:#7399d4} .fpk-it.on .fpk-tick{background:#ff9a3c;border-color:#fff3}
    .fpk-foot{background:#071325e6;border-top:2px solid #ee8a3555}
    .fpk-go{border-radius:0;background:linear-gradient(135deg,#5b3fd6,#40279e 60%,#2e1a7c);border:2px solid #ff9a3c;
      clip-path:polygon(12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px),0 12px);
      font:800 22px/1 "Exo 2","Arial Black",sans-serif;text-shadow:0 2px 0 #1a0c55}
    .fpk-chip{border-radius:4px;background:#3a2410;border:1.5px solid #ee8a35;padding:3px 6px 3px 9px}`,
    // Hop Rush: blocky pixel frames (notched corners, dark outline, light/dark bevel), Press Start 2P tags, Pixelify Sans text
    pixel: `
    .fpk-ov{background:rgba(13,16,48,.62);-webkit-backdrop-filter:none;backdrop-filter:none}
    .fpk{--u:5px;background:#262b5c;border:var(--u) solid #0d1030;border-radius:0;font-family:"Pixelify Sans",system-ui,sans-serif;
      box-shadow:inset -5px -5px 0 rgba(0,0,0,.3),inset 5px 5px 0 rgba(255,255,255,.13);
      clip-path:polygon(0 5px,5px 5px,5px 0,calc(100% - 5px) 0,calc(100% - 5px) 5px,100% 5px,100% calc(100% - 5px),calc(100% - 5px) calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,5px calc(100% - 5px),0 calc(100% - 5px))}
    .fpk-top{border-bottom:5px solid #0d1030;background:#323872}
    .fpk-h b{font:400 clamp(18px,2.8vh,28px)/1.2 "Press Start 2P",monospace;color:#ffd23f;text-shadow:4px 4px 0 #0d1030}
    .fpk-kick{font:400 11px/1 "Press Start 2P",monospace;letter-spacing:.06em;color:#c9cdf8}
    .fpk-x{border-radius:0;background:#ff4d6d;border:4px solid #0d1030;font-family:"Press Start 2P",monospace;font-size:16px;box-shadow:inset -4px -4px 0 rgba(0,0,0,.3)}
    .fpk-lv button{border-radius:0;border:4px solid #0d1030;background:#171a3d;box-shadow:inset -4px -4px 0 rgba(0,0,0,.3),inset 4px 4px 0 rgba(255,255,255,.1)}
    .fpk-lv button:hover{background:#2e3470}
    .fpk-lv button.on{background:#3b4282;outline:4px solid var(--c);outline-offset:-8px}
    .fpk-lv button b{font:400 15px/1.3 "Press Start 2P",monospace}
    .fpk-lv button b i{border-radius:0;padding:2px 6px}
    .fpk-lv button small{font-family:"Pixelify Sans",sans-serif;font-weight:600;font-size:14px}
    .fpk-lv button em{border-radius:0;font-family:"Press Start 2P",monospace;font-size:9px;padding:4px 5px}
    .fpk-seg{border-radius:0;padding:4px;background:#171a3d;border:4px solid #0d1030}
    .fpk-seg button{border-radius:0;font:400 12px/1 "Press Start 2P",monospace;padding:10px 12px}
    .fpk-seg button small{font-family:"Pixelify Sans",sans-serif;font-size:14px}
    .fpk-seg button.on{background:#ffd23f;color:#0d1030;box-shadow:inset -3px -3px 0 rgba(0,0,0,.25)}
    .fpk-q{border-radius:0;border:4px solid #0d1030;background:#171a3d;font:600 17px "Pixelify Sans",sans-serif}
    .fpk-q::placeholder{color:#8e93cf}
    .fpk-q:focus{border-color:#ffd23f}
    .fpk-list{scrollbar-color:#5b5ff0 #171a3d}
    .fpk-it{border-radius:0;border:4px solid #0d1030;background:#323872;box-shadow:inset -4px -4px 0 rgba(0,0,0,.25),inset 4px 4px 0 rgba(255,255,255,.08)}
    .fpk-it:hover{background:#3b4282}
    .fpk-it.on{background:#2f7a52;box-shadow:inset -4px -4px 0 rgba(0,0,0,.25),inset 4px 4px 0 rgba(255,255,255,.18)}
    .fpk-n{border-radius:0;border:3px solid #0d1030;font:400 13px/1 "Press Start 2P",monospace}
    .fpk-t b{font-family:"Pixelify Sans",sans-serif;font-weight:700;font-size:18px}
    .fpk-t small{font-family:"Pixelify Sans",sans-serif;font-weight:500;font-size:14px}
    .fpk-c{font-family:"Press Start 2P",monospace;font-size:9px;font-weight:400}
    .fpk-tick{border-radius:0;border:4px solid #0d1030;background:#171a3d}
    .fpk-it.on .fpk-tick{background:#3ddc84;color:#0d1030}
    .fpk-tag{border-radius:0;font-family:"Press Start 2P",monospace;font-size:8px;font-weight:400;padding:3px 4px}
    .fpk-foot{background:#323872;border-top:5px solid #0d1030}
    .fpk-chip{border-radius:0;background:#171a3d;border:3px solid #3ddc84;font-family:"Pixelify Sans",sans-serif;font-weight:700;font-size:14px}
    .fpk-chip:hover{background:#2f7a52}
    .fpk-clear{font-family:"Pixelify Sans",sans-serif}
    .fpk-go{border-radius:0;background:#ffd23f;color:#0d1030;border:5px solid #0d1030;font:400 14px/1.3 "Press Start 2P",monospace;padding:16px 18px;
      box-shadow:inset -5px -6px 0 rgba(0,0,0,.25),inset 5px 5px 0 rgba(255,255,255,.4)}
    .fpk-go:active:not(:disabled){transform:translateY(4px)}
    .fpk-empty{font-family:"Press Start 2P",monospace;font-size:12px;font-weight:400;line-height:1.6}`,
    // Foxino's Odyssey: parchment paper with a stitched inner line, paper-tag buttons, Cinzel titles, Nunito text
    paper: `
    .fpk-ov{background:rgba(60,40,15,.4);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);color:#4a3423}
    .fpk{background:#f8eedb;border:2px solid #d9c39a;border-radius:10px;outline:2px dashed rgba(150,110,60,.32);outline-offset:-9px;box-shadow:0 3px 0 #cdb486,0 24px 50px rgba(60,35,10,.35);font-family:Nunito,system-ui,sans-serif;color:#4a3423}
    .fpk-top{border-bottom:2px solid #e2cfa6}
    .fpk-h b{font:900 clamp(22px,3.4vh,34px)/1.1 "Cinzel Decorative",Cinzel,Georgia,serif;color:#4a3423}
    .fpk-kick{font:900 12px/1 Cinzel,Georgia,serif;letter-spacing:.2em;color:#c0533a}
    .fpk-x{border-radius:8px;background:#fff6e4;color:#4a3423;border:2px solid #d9c39a;box-shadow:0 3px 0 #d9c39a}
    .fpk-lv button{border-radius:8px;border:2px solid #d9c39a;background:#fffaf0;color:#4a3423;box-shadow:0 3px 0 #e2cfa6}
    .fpk-lv button:hover{background:#fff}
    .fpk-lv button.on{border-color:#c0533a;background:#fff;box-shadow:0 3px 0 #c0533a}
    .fpk-lv button b{font-family:Cinzel,Georgia,serif;font-weight:900}
    .fpk-lv button b i{border-radius:5px}
    .fpk-seg{border-radius:8px;background:#efe0c2;border:2px solid #d9c39a}
    .fpk-seg button{border-radius:6px;color:#7a5a3a;font-family:Cinzel,Georgia,serif;font-weight:900}
    .fpk-seg button.on{background:#c0533a;color:#fff8ea}
    .fpk-q{border-radius:8px;border-color:#d9c39a;background:#fffaf0;color:#4a3423}
    .fpk-q::placeholder{color:#b39b78}
    .fpk-q:focus{border-color:#3d7bd1}
    .fpk-list{scrollbar-color:#d9c39a transparent}
    .fpk-it{border-radius:8px;border:2px solid #e2cfa6;background:#fffaf0;color:#4a3423}
    .fpk-it:hover{border-color:#c9ad78;background:#fff}
    .fpk-it.on{border-color:#4f9a3a;background:#eef7e2}
    .fpk-n{border-radius:6px}
    .fpk-t b{font-weight:900}
    .fpk-t small,.fpk-c{color:#7a5a3a;opacity:1}
    .fpk-tick{border-radius:6px;border-color:#c9ad78;background:#fff}
    .fpk-it.on .fpk-tick{background:#4f9a3a;border-color:#356b26;color:#fff}
    .fpk-tag{background:#efe0c2;color:#7a5a3a}
    .fpk-foot{background:#f3e5c8;border-top:2px solid #e2cfa6}
    .fpk-chips>span{color:#7a5a3a}
    .fpk-chip{border-radius:999px;background:#fffaf0;color:#4a3423;border:2px solid #4f9a3a}
    .fpk-clear{color:#7a5a3a}
    .fpk-go{border-radius:8px;background:#c0533a;color:#fff8ea;font:900 17px/1 Cinzel,Georgia,serif;letter-spacing:.04em;box-shadow:0 5px 0 #8e3a26}
    .fpk-go:active:not(:disabled){transform:translateY(4px);box-shadow:0 1px 0 #8e3a26}`,
  };
  const base = `
  .fpk-ov{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:14px;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);color:#fff;animation:fpkIn .2s ease-out}
  @keyframes fpkIn{from{opacity:0}}
  .fpk{width:min(840px,100%);height:min(92vh,880px);display:flex;flex-direction:column;overflow:hidden}
  .fpk-top{padding:18px 20px 12px;display:flex;flex-direction:column;gap:12px;border-bottom:1px solid rgba(255,255,255,.12)}
  .fpk-h{display:flex;align-items:center;gap:12px}
  .fpk-h>div{flex:1;display:flex;flex-direction:column;gap:6px}
  .fpk-x{width:42px;height:42px;border:0;color:#fff;font-size:22px;cursor:pointer;flex:none}
  .fpk-lv{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
  .fpk-lv button{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:9px 12px;color:#fff;cursor:pointer;text-align:left;font:inherit}
  .fpk-lv button b{font-size:18px;font-weight:900} .fpk-lv button b i{font-style:normal;display:inline-block;padding:1px 7px;margin-right:6px;background:var(--c);color:#10142a}
  .fpk-lv button small{font-size:12px;font-weight:800;opacity:.7}
  .fpk-lv button em{position:absolute;top:7px;right:8px;font-style:normal;font-size:11px;font-weight:900;padding:2px 7px;border-radius:999px;background:var(--c);color:#10142a}
  .fpk-lv button em:empty{display:none}
  .fpk-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .fpk-seg{display:flex;padding:3px}
  .fpk-seg button{padding:8px 14px;border:0;background:none;color:#dfe6ff;font:inherit;font-weight:900;font-size:14px;cursor:pointer}
  .fpk-seg button small{opacity:.7;font-weight:800;margin-left:4px}
  .fpk-q{flex:1;min-width:160px;padding:9px 12px;border:2px solid rgba(255,255,255,.18);color:#fff;font:inherit;font-weight:800;font-size:15px;outline:none}
  .fpk-list{flex:1;overflow:auto;padding:10px 14px 16px;display:flex;flex-direction:column;gap:7px;-webkit-overflow-scrolling:touch}
  .fpk-it{flex:none;display:grid;grid-template-columns:30px 44px 1fr auto;align-items:center;gap:12px;width:100%;padding:9px 12px;color:#fff;font:inherit;text-align:left;cursor:pointer;transition:background .15s,border-color .15s}
  .fpk-tick{width:28px;height:28px;display:grid;place-items:center;border:2px solid rgba(255,255,255,.4);font-weight:900;font-size:17px;color:transparent}
  .fpk-it.on .fpk-tick{color:#fff}
  .fpk-n{display:grid;place-items:center;height:36px;background:var(--c);color:#10142a;font-weight:900;font-size:16px}
  .fpk-t{min-width:0}
  .fpk-t b{display:block;font-weight:900;font-size:16px;line-height:1.2}
  .fpk-t small{display:block;font-weight:700;font-size:13px;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .fpk-c{font-weight:900;font-size:13px;opacity:.7;white-space:nowrap}
  .fpk-tag{font-size:11px;font-weight:900;letter-spacing:.06em;padding:1px 6px;border-radius:6px;background:rgba(255,255,255,.14);margin-left:6px;vertical-align:2px}
  .fpk-empty{opacity:.7;font-weight:800;text-align:center;padding:30px}
  .fpk-foot{display:flex;align-items:center;gap:12px;padding:12px 16px;border-top:1px solid rgba(255,255,255,.12)}
  .fpk-chips{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-content:flex-start;gap:6px;max-height:84px;overflow:auto;padding:2px}
  .fpk-chips>span{font-weight:800;font-size:14px;opacity:.75}
  .fpk-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 6px 4px 10px;font-weight:900;font-size:13px;color:#fff;cursor:pointer;font-family:inherit}
  .fpk-chip i{font-style:normal;opacity:.8}
  .fpk-clear{background:none;border:0;color:#fff;opacity:.7;font:inherit;font-weight:900;font-size:13px;cursor:pointer;text-decoration:underline}
  .fpk-go{flex:none;padding:14px 24px;border:0;color:#fff;cursor:pointer;white-space:nowrap}
  .fpk-go:disabled{opacity:.45;cursor:default}
  @media (max-width:600px){.fpk-lv button small{display:none}.fpk-it{grid-template-columns:28px 38px 1fr}.fpk-c{display:none}.fpk-foot{flex-wrap:wrap}.fpk-go{width:100%}}`;
  // a theme's rules only apply inside its own overlay (.fpk-ov.fpk-<theme>)
  const scope = (css, theme) => css.split('}').map((rule) => {
    const i = rule.indexOf('{'); if (i < 0) return rule;
    const sel = rule.slice(0, i).split(',').map((x) => x.trim()).filter(Boolean)
      .map((x) => x.startsWith('.fpk-ov') ? x.replace('.fpk-ov', `.fpk-ov.fpk-${theme}`) : `.fpk-ov.fpk-${theme} ${x}`).join(',');
    return sel + rule.slice(i);
  }).join('}');
  const styled = {};
  function open(packs, chosen, opts = {}) {
    const theme = THEMES[opts.theme] ? opts.theme : 'gummy';
    if (!styled.base) { const st = document.createElement('style'); st.textContent = base; document.head.appendChild(st); styled.base = true; }
    if (!styled[theme]) { const st = document.createElement('style'); st.textContent = scope(THEMES[theme], theme); document.head.appendChild(st); styled[theme] = true; }
    const all = sort(packs), byId = new Map(all.map((p) => [p.id, p]));
    let sel = (Array.isArray(chosen) ? chosen : [chosen]).filter((id) => byId.has(id));
    const first = byId.get(sel[0]);
    const levels = Object.keys(LEVELS).filter((l) => all.some((p) => p.level === l));
    let lv = first ? first.level : levels[0], kind = first ? (first.kind || 'Grammar') : 'Grammar', q = '';
    return new Promise((resolve) => {
      const ov = document.createElement('div'); ov.className = `fpk-ov fpk-${theme}`;
      ov.innerHTML = `<div class="fpk" role="dialog" aria-label="Choose packages">
        <div class="fpk-top">
          <div class="fpk-h"><div><span class="fpk-kick">${esc(opts.kicker || 'QUESTIONS')}</span><b>Choose packages</b></div><button class="fpk-x" data-x aria-label="Close">&times;</button></div>
          <div class="fpk-lv">${levels.map((l) => `<button data-lv="${l}" style="--c:${LEVELS[l].c}"><b><i>${l}</i>${LEVELS[l].name}</b><small>${LEVELS[l].sub}</small><em></em></button>`).join('')}</div>
          <div class="fpk-row"><div class="fpk-seg">${KINDS.map((k) => `<button data-kind="${k}">${k}<small></small></button>`).join('')}</div>
            <input class="fpk-q" type="search" placeholder="Search all topics…" aria-label="Search the topics"></div>
        </div>
        <div class="fpk-list"></div>
        <div class="fpk-foot"><div class="fpk-chips"></div><button class="fpk-go" data-go></button></div></div>`;
      document.body.appendChild(ov);
      const list = ov.querySelector('.fpk-list'), input = ov.querySelector('.fpk-q');
      const done = (v) => { ov.remove(); removeEventListener('keydown', onKey, true); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
      addEventListener('keydown', onKey, true);
      const foot = () => {
        const ps = sel.map((id) => byId.get(id));
        ov.querySelector('.fpk-chips').innerHTML = ps.length
          ? ps.map((p) => `<button class="fpk-chip" data-un="${esc(p.id)}" title="Remove">${esc(p.level)} · ${esc(p.title.split(' – ')[0])}<i>&times;</i></button>`).join('') + (ps.length > 1 ? '<button class="fpk-clear" data-clear>Clear all</button>' : '')
          : '<span>Tick one or more topics. Their questions are mixed in the game.</span>';
        const go = ov.querySelector('.fpk-go'); go.disabled = !ps.length;
        go.textContent = ps.length > 1 ? `Play with ${ps.length} packages · ${ps.reduce((s, p) => s + p.count, 0)} questions` : ps.length ? `Play · ${ps[0].count} questions` : 'Choose a package';
        ov.querySelectorAll('[data-lv]').forEach((b) => { const n = sel.filter((id) => byId.get(id).level === b.dataset.lv).length; b.querySelector('em').textContent = n ? `${n} chosen` : ''; });
      };
      const render = () => {
        ov.querySelectorAll('[data-lv]').forEach((b) => b.classList.toggle('on', !q && b.dataset.lv === lv));
        ov.querySelectorAll('[data-kind]').forEach((b) => {
          b.classList.toggle('on', !q && b.dataset.kind === kind);
          b.querySelector('small').textContent = all.filter((p) => p.level === lv && (p.kind || 'Grammar') === b.dataset.kind).length;
        });
        const words = q.toLowerCase().split(/\s+/).filter(Boolean);
        const shown = words.length
          ? all.filter((p) => words.every((w) => `${p.level} ${p.kind} ${p.title} ${p.subtitle}`.toLowerCase().includes(w)))
          : all.filter((p) => p.level === lv && (p.kind || 'Grammar') === kind);
        list.innerHTML = shown.length ? shown.map((p) => `<button class="fpk-it${sel.includes(p.id) ? ' on' : ''}" data-id="${esc(p.id)}" role="checkbox" aria-checked="${sel.includes(p.id)}" style="--c:${(LEVELS[p.level] || {}).c || '#b57bff'}">
            <span class="fpk-tick">&#10003;</span><span class="fpk-n">${words.length ? esc(p.level) : num(p)}</span>
            <span class="fpk-t"><b>${esc(p.title)}${words.length ? `<span class="fpk-tag">${esc(p.kind || 'Grammar')} ${num(p)}</span>` : ''}</b><small>${esc(p.subtitle)}</small></span>
            <span class="fpk-c">${p.count} questions</span></button>`).join('')
          : '<div class="fpk-empty">No topic matches your search.</div>';
        foot();
      };
      const toggle = (id) => {
        if (sel.includes(id)) sel = sel.filter((x) => x !== id);
        else if (sel.length >= MAX) { const go = ov.querySelector('.fpk-go'); go.textContent = `At most ${MAX} packages`; return; }
        else sel = [...sel, id];
        list.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach((b) => { b.classList.toggle('on', sel.includes(id)); b.setAttribute('aria-checked', sel.includes(id)); });
        foot();
      };
      ov.addEventListener('click', (e) => {
        const t = e.target;
        if (t === ov || t.closest('[data-x]')) return done(null);
        const b = t.closest('[data-lv]'); if (b) { lv = b.dataset.lv; q = ''; input.value = ''; list.scrollTop = 0; return render(); }
        const k = t.closest('[data-kind]'); if (k) { kind = k.dataset.kind; q = ''; input.value = ''; list.scrollTop = 0; return render(); }
        const it = t.closest('[data-id]'); if (it) return toggle(it.dataset.id);
        const un = t.closest('[data-un]'); if (un) { toggle(un.dataset.un); return; }
        if (t.closest('[data-clear]')) { sel = []; return render(); }
        if (t.closest('[data-go]') && sel.length) done(sel.slice());
      });
      input.addEventListener('input', () => { q = input.value.trim(); render(); });
      render();
      // open at the first ticked topic (after layout, so the list has its height)
      requestAnimationFrame(() => { const on = list.querySelector('.on'); if (!on) return; const a = on.getBoundingClientRect(), l = list.getBoundingClientRect(); list.scrollTop += a.top - l.top - (l.height - a.height) / 2; });
    });
  }
  window.FugioPacks = {open, sort, label, merge, summary, LEVELS, MAX};
})();
