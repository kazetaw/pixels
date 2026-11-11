// pixelIcons.ts — pixel-art SVG generator + built-in avatars & item icons

/**
 * Generates an SVG string from an ASCII grid.
 * Each character maps to a hex color; '.' is transparent.
 * Grid must be rectangular (all rows same length).
 */
export function px(grid: string[], palette: Record<string, string>): string {
  const H = grid.length;
  const W = grid[0]?.length ?? 0;
  const rects: string[] = [];

  for (let y = 0; y < H; y++) {
    const row = grid[y];
    for (let x = 0; x < W; x++) {
      const ch = row[x] ?? '.';
      if (ch === '.') continue;
      const fill = palette[ch];
      if (!fill) continue;
      rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIXEL AVATARS  16×16
// ─────────────────────────────────────────────────────────────────────────────

function makeEngineer(): string {
  // Hard-hat blue collar worker
  const p = { H: '#fbbf24', F: '#fde68a', S: '#3b82f6', b: '#1e3a5f', w: '#ffffff', e: '#1e293b' };
  const g = [
    '....HHHHHH......', // 0
    '...HbbbbbH......', // 1
    '..HHbbbbbHH.....', // 2
    '...FFFFFFF......', // 3
    '...FeeeFeF......', // 4
    '...FFFFFFF......', // 5
    '...F.www.F......', // 6
    '....FFFFF.......', // 7
    '...SSSSSSS......', // 8
    '..SSSSSSSSS.....', // 9
    '..SSS...SSS.....', // 10
    '..SSS...SSS.....', // 11
    '..SSS...SSS.....', // 12
    '..SSS...SSS.....', // 13
    '..bbb...bbb.....', // 14
    '..bbb...bbb.....', // 15
  ];
  return px(g, p);
}

function makeDoctor(): string {
  // White coat, stethoscope
  const p = { F: '#fde68a', e: '#1e293b', w: '#ffffff', r: '#ef4444', p: '#f9a8d4', b: '#0f172a' };
  const g = [
    '....FFFFFF......',
    '....FeeFFF......',
    '....FFFFFF......',
    '....F.ww.F......',
    '....FFFFFF......',
    '...wwwwwwww.....', // white collar
    '...wwwwwwww.....',
    '..wwwwwwwwww....',
    '..www.rr.www....',
    '..wwwwrrrwww....',
    '..www.rr.www....',
    '..wwwwwwwwww....',
    '..www....www....',
    '..www....www....',
    '..bbb....bbb....',
    '..bbb....bbb....',
  ];
  return px(g, p);
}

function makeChef(): string {
  // Tall chef hat, apron
  const p = { F: '#fde68a', e: '#1e293b', w: '#ffffff', b: '#1e293b', o: '#f97316', r: '#fca5a5' };
  const g = [
    '....wwwwww......', // chef hat
    '...wwwwwwww.....',
    '...wwwwwwww.....',
    '...wwwwwwww.....',
    '...FFFFFFFF.....',
    '...FeeFFeeF.....',
    '...FFFFFFFF.....',
    '...F.rrrr.F.....',
    '...FFFFFFFF.....',
    '..oooooooooo....',
    '..oooooooooo....',
    '..oooooooooo....',
    '..ooo....ooo....',
    '..ooo....ooo....',
    '..bbb....bbb....',
    '..bbb....bbb....',
  ];
  return px(g, p);
}

function makeIdol(): string {
  // Star outfit, sparkle hair
  const p = { F: '#fde68a', e: '#1e293b', s: '#a855f7', p: '#f9a8d4', w: '#ffffff', b: '#1e293b', y: '#fbbf24' };
  const g = [
    '....yy..yy......',
    '...yFFFFFy......',
    '..yyFFFFFyy.....',
    '...FeeFFeeF.....',
    '...FFFFFFFFF....',
    '...F.p..p.F.....',
    '...FFFFFFFFF....',
    '..sssssssssss...',
    '..ssssssssss....',
    '..sssssssssss...',
    '..ss.......ss...',
    '..ss.......ss...',
    '..ss.......ss...',
    '..ss.......ss...',
    '..bb.......bb...',
    '..bb.......bb...',
  ];
  return px(g, p);
}

function makeFarmer(): string {
  // Straw hat, overalls
  const p = { F: '#fde68a', e: '#1e293b', h: '#d97706', g: '#4ade80', b: '#1e3a5f', w: '#ffffff', r: '#78350f' };
  const g = [
    '.....hhhhhh.....',
    '...hhhhhhhhhh...',
    '...hFFFFFFFh....',
    '....FFFFFFF.....',
    '....FeeFFeeF....',
    '....FFFFFFF.....',
    '....F.www.F.....',
    '....FFFFFFF.....',
    '...bbbbbbbbb....',
    '..bbbbbbbbbbb...',
    '..bbb.....bbb...',
    '..bbb.....bbb...',
    '..bbb.....bbb...',
    '..bbb.....bbb...',
    '..rrr.....rrr...',
    '..rrr.....rrr...',
  ];
  return px(g, p);
}

export const PIXEL_AVATARS: Record<string, string> = {
  engineer: makeEngineer(),
  doctor:   makeDoctor(),
  chef:     makeChef(),
  idol:     makeIdol(),
  farmer:   makeFarmer(),
};

// ─────────────────────────────────────────────────────────────────────────────
// PIXEL ICONS  8×8
// ─────────────────────────────────────────────────────────────────────────────

function makeCircuit(): string {
  const p = { g: '#4ade80', b: '#1e293b', y: '#fbbf24' };
  const grid = [
    'bbbbbbbb',
    'byb..byb',
    'bgbggbgb',
    'b.bggb.b',
    'bggggggb',
    'b.bggb.b',
    'byb..byb',
    'bbbbbbbb',
  ];
  return px(grid, p);
}

function makeIron(): string {
  const p = { s: '#94a3b8', b: '#1e293b', w: '#e2e8f0' };
  const grid = [
    '..bbbb..',
    '.bssssb.',
    'bsswwssb',
    'bsswwssb',
    '.bssssb.',
    '..bssb..',
    '..bssb..',
    '...bb...',
  ];
  return px(grid, p);
}

function makeMedicine(): string {
  const p = { r: '#ef4444', w: '#ffffff', b: '#1e293b' };
  const grid = [
    '..bbbbb.',
    '.bwwwwb.',
    'bwwrwwwb',
    'bwrrrwwb',
    'bwwrwwwb',
    '.bwwwwb.',
    '..bbbb..',
    '........',
  ];
  return px(grid, p);
}

function makePotion(): string {
  const p = { p: '#a855f7', b: '#1e293b', w: '#ffffff', l: '#d8b4fe' };
  const grid = [
    '...bb...',
    '..bwwb..',
    '..bwwb..',
    '.bppppb.',
    'bpplpplb',
    'bpppppbb',
    '.bppppb.',
    '..bbbb..',
  ];
  return px(grid, p);
}

function makeFlask(): string {
  const p = { c: '#7dd3fc', b: '#1e293b', w: '#bfdbfe', y: '#fbbf24' };
  const grid = [
    '..bccb..',
    '..bccb..',
    '.bcccccb',
    'bccccccb',
    'bcwwwccb',
    'bccwccyb',
    '.bccccb.',
    '..bbbb..',
  ];
  return px(grid, p);
}

function makeHerb(): string {
  const p = { g: '#4ade80', b: '#1e293b', d: '#16a34a', s: '#78350f' };
  const grid = [
    '...d.d..',
    '..dgd...',
    '.ddgdd..',
    'd.gggg..',
    '..dgddd.',
    '...bss..',
    '...bss..',
    '...bbb..',
  ];
  return px(grid, p);
}

function makeGear(): string {
  const p = { s: '#94a3b8', b: '#1e293b', w: '#e2e8f0' };
  const grid = [
    '..sbbs..',
    '.ssssss.',
    'bswwwwsb',
    'bswwwwsb',
    'bswwwwsb',
    'bswwwwsb',
    '.ssssss.',
    '..sbbs..',
  ];
  return px(grid, p);
}

function makeBattery(): string {
  const p = { g: '#4ade80', b: '#1e293b', y: '#fbbf24', w: '#e2e8f0' };
  const grid = [
    '.bbbbbb.',
    'bwwwwwwb',
    'bggggwwb',
    'bggggwwb',
    'bggggwwb',
    'bwwwwwwb',
    '.bbbbbb.',
    '...bb...',
  ];
  return px(grid, p);
}

export const PIXEL_ICONS: Record<string, string> = {
  circuit:  makeCircuit(),
  iron:     makeIron(),
  medicine: makeMedicine(),
  potion:   makePotion(),
  flask:    makeFlask(),
  herb:     makeHerb(),
  gear:     makeGear(),
  battery:  makeBattery(),
};
