// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { oklchToSrgb, type Rgb } from '../../test/colorMath';
import { THEME_BLOCKS } from '../../test/styleTokens';

const STYLES = join(__dirname, '..', '..', 'styles.css');

const BODY_FLOOR = 4.5;
const LARGE_FLOOR = 3;

const SURFACES = ['chrome', 'background', 'subtle', 'muted', 'elevated', 'floating'] as const;
const READ_SURFACES = [...SURFACES, 'drawer'] as const;
const DROP_CHIP_ALPHA = 0.76;
const STEP_FLOOR = 1.04;
const DRAWER_STEP_FLOOR = 1.03;
const FILL_FLOOR = 1.1;
const BOX_BORDER_FLOOR = 1.4;
const TONES = ['primary', 'info', 'success', 'warning', 'danger', 'merged', 'draft'] as const;
const TINT_STEPS = ['wash', 'subtle'] as const;
// The diff viewer paints code on the canvas and on hunk rows, never on a card.
const CODE_SURFACES = ['background', 'subtle', 'muted'] as const;

const linearise = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const relativeLuminance = ([r, g, b]: Rgb): number =>
  0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);

const contrast = (foreground: Rgb, background: Rgb): number => {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

type Palette = Readonly<Record<string, Rgb>>;

const swatch = (palette: Palette, token: string): Rgb => {
  const rgb = palette[token];
  if (rgb === undefined) {
    throw new Error(`styles.css has no --color-${token}`);
  }
  return rgb;
};

const OPAQUE_OKLCH = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/;
const HEX = /^#([0-9a-f]{6})$/i;
const ALIAS = /^var\(--color-([a-z0-9-]+)\)$/;
const ALIAS_DEPTH = 8;

type ResolveSwatchParams = {
  declared: ReadonlyMap<string, string>;
  token: string;
  depth: number;
};

const resolveSwatch = ({ declared, token, depth }: ResolveSwatchParams): Rgb | null => {
  const value = declared.get(token);
  if (value === undefined || depth > ALIAS_DEPTH) {
    return null;
  }
  const oklch = value.match(OPAQUE_OKLCH);
  if (oklch !== null) {
    return oklchToSrgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]));
  }
  const hex = value.match(HEX);
  if (hex !== null) {
    const digits = String(hex[1]);
    return [
      Number.parseInt(digits.slice(0, 2), 16) / 255,
      Number.parseInt(digits.slice(2, 4), 16) / 255,
      Number.parseInt(digits.slice(4, 6), 16) / 255,
    ];
  }
  const alias = value.match(ALIAS);
  if (alias !== null) {
    return resolveSwatch({ declared, token: String(alias[1]), depth: depth + 1 });
  }
  return null;
};

const readPalette = (block: string): Palette => {
  const declared = new Map<string, string>();
  for (const match of block.matchAll(/--color-([a-z0-9-]+):([^;]+);/g)) {
    declared.set(String(match[1]), String(match[2]).trim().replace(/\s+/g, ' '));
  }
  const palette: Record<string, Rgb> = {};
  for (const token of declared.keys()) {
    const rgb = resolveSwatch({ declared, token, depth: 0 });
    if (rgb !== null) {
      palette[token] = rgb;
    }
  }
  return palette;
};

const composite = ({
  foreground,
  background,
  alpha,
}: {
  foreground: Rgb;
  background: Rgb;
  alpha: number;
}): Rgb => [
  foreground[0] * alpha + background[0] * (1 - alpha),
  foreground[1] * alpha + background[1] * (1 - alpha),
  foreground[2] * alpha + background[2] * (1 - alpha),
];

type Lab = readonly [number, number, number];

const readLabs = (block: string): Readonly<Record<string, Lab>> => {
  const labs: Record<string, Lab> = {};
  const pattern = /--color-([a-z0-9-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)\s*;/g;
  for (const match of block.matchAll(pattern)) {
    const chroma = Number(match[3]);
    const radians = (Number(match[4]) * Math.PI) / 180;
    labs[String(match[1])] = [
      Number(match[2]),
      chroma * Math.cos(radians),
      chroma * Math.sin(radians),
    ];
  }
  return labs;
};

const themeBlocks = (): Readonly<{ dark: string; light: string }> => {
  const css = readFileSync(STYLES, 'utf8');
  const lightStart = css.indexOf("html[data-theme='light'] {");
  return {
    dark: THEME_BLOCKS.dark,
    light: css.slice(lightStart, css.indexOf('\n}', lightStart)),
  };
};

const readLabThemes = (): Readonly<Record<'dark' | 'light', Readonly<Record<string, Lab>>>> => {
  const blocks = themeBlocks();
  const dark = readLabs(blocks.dark);
  return { dark, light: { ...dark, ...readLabs(blocks.light) } };
};

const deltaE = ({ first, second }: { first: Lab; second: Lab }): number =>
  100 * Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);

const lab = ({ labs, token }: { labs: Readonly<Record<string, Lab>>; token: string }): Lab => {
  const value = labs[token];
  if (value === undefined) {
    throw new Error(`styles.css has no oklch --color-${token}`);
  }
  return value;
};

const TONE_SEPARATION = 6;
const IDENTITY_SEPARATION = 4.5;

const readThemes = (): Readonly<Record<'dark' | 'light', Palette>> => {
  const blocks = themeBlocks();
  return { dark: readPalette(blocks.dark), light: readPalette(blocks.dark + blocks.light) };
};

type Translucent = Readonly<{ rgb: Rgb; alpha: number }>;

const readTranslucent = ({ block, token }: { block: string; token: string }): Translucent => {
  const pattern = new RegExp(
    `--color-${token}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\s*/\\s*([\\d.]+)\\s*\\)\\s*;`,
  );
  const match = block.match(pattern);
  if (match === null) {
    throw new Error(`styles.css has no translucent oklch --color-${token}`);
  }
  return {
    rgb: oklchToSrgb(Number(match[1]), Number(match[2]), Number(match[3])),
    alpha: Number(match[4]),
  };
};

const readShadow = ({ block, name }: { block: string; name: string }): string => {
  const match = block.match(new RegExp(`--elevation-${name}:([^;]+);`));
  if (match === null) {
    throw new Error(`styles.css has no --elevation-${name}`);
  }
  return String(match[1]).trim();
};

describe.each(['dark', 'light'] as const)('%s palette', (theme) => {
  const palette = readThemes()[theme];
  const block = themeBlocks()[theme];

  it.each(READ_SURFACES)('carries body and tone text at 4.5:1 on %s', (surface) => {
    const failures = ['foreground', 'muted-foreground', 'faint-foreground', ...TONES]
      .map((token) => ({
        token,
        ratio: contrast(swatch(palette, token), swatch(palette, surface)),
      }))
      .filter(({ ratio }) => ratio < BODY_FLOOR);
    expect(failures).toEqual([]);
  });

  it.each([
    ['a white page', [1, 1, 1]],
    ['a black page', [0, 0, 0]],
  ] as const)('keeps the drop chip label at 4.5:1 over %s', (_name, page) => {
    const chip = composite({
      foreground: swatch(palette, 'floating'),
      background: page,
      alpha: DROP_CHIP_ALPHA,
    });
    expect(contrast(swatch(palette, 'foreground'), chip)).toBeGreaterThanOrEqual(BODY_FLOOR);
  });

  it('keeps the hovered drop chip on the button pair', () => {
    expect(
      contrast(swatch(palette, 'on-primary'), swatch(palette, 'primary-solid')),
    ).toBeGreaterThanOrEqual(BODY_FLOOR);
  });

  it.each(READ_SURFACES)('keeps disabled text distinguishable on %s', (surface) => {
    expect(
      contrast(swatch(palette, 'disabled-foreground'), swatch(palette, surface)),
    ).toBeGreaterThanOrEqual(LARGE_FLOOR);
  });

  it.each(CODE_SURFACES)('keeps every syntax colour readable on %s', (surface) => {
    const failures = Object.keys(palette)
      .filter((token) => token.startsWith('syntax-'))
      .map((token) => ({
        token,
        ratio: contrast(swatch(palette, token), swatch(palette, surface)),
      }))
      .filter(({ ratio }) => ratio < BODY_FLOOR);
    expect(failures).toEqual([]);
  });

  it.each(TINT_STEPS)('keeps tone text readable on its %s step', (step) => {
    const failures = TONES.map((tone) => ({
      tone,
      ratio: contrast(swatch(palette, tone), swatch(palette, `${tone}-${step}`)),
    })).filter(({ ratio }) => ratio < BODY_FLOOR);
    expect(failures).toEqual([]);
  });

  it.each(READ_SURFACES)('keeps agent labels readable on %s', (surface) => {
    const failures = Object.keys(palette)
      .filter((token) => token.startsWith('agent-'))
      .map((token) => ({
        token,
        ratio: contrast(swatch(palette, token), swatch(palette, surface)),
      }))
      .filter(({ ratio }) => ratio < BODY_FLOOR);
    expect(failures).toEqual([]);
  });

  it.each(READ_SURFACES)('keeps agent labels readable on their own tint over %s', (surface) => {
    const failures = Object.keys(palette)
      .filter((token) => token.startsWith('agent-'))
      .map((token) => ({
        token,
        ratio: contrast(
          swatch(palette, token),
          composite({
            foreground: swatch(palette, token),
            background: swatch(palette, surface),
            alpha: 0.12,
          }),
        ),
      }))
      .filter(({ ratio }) => ratio < BODY_FLOOR);
    expect(failures).toEqual([]);
  });

  it.each(READ_SURFACES)(
    'keeps history action colours readable on %s and on their mark',
    (surface) => {
      const tokens = Object.keys(palette).filter((token) => token.startsWith('history-'));
      expect(tokens).toEqual(['history-fixup', 'history-squash', 'history-move']);
      const failures = tokens
        .flatMap((token) => [
          { token, ratio: contrast(swatch(palette, token), swatch(palette, surface)) },
          {
            token: `${token} on its mark`,
            ratio: contrast(
              swatch(palette, token),
              composite({
                foreground: swatch(palette, token),
                background: swatch(palette, surface),
                alpha: 0.12,
              }),
            ),
          },
        ])
        .filter(({ ratio }) => ratio < BODY_FLOOR);
      expect(failures).toEqual([]);
    },
  );

  it.each(READ_SURFACES)('keeps identity labels readable on %s', (surface) => {
    const failures = Object.keys(palette)
      .filter((token) => token.startsWith('identity-'))
      .map((token) => ({
        token,
        ratio: contrast(swatch(palette, token), swatch(palette, surface)),
      }))
      .filter(({ ratio }) => ratio < BODY_FLOOR);
    expect(failures).toEqual([]);
  });

  it.each(READ_SURFACES)('keeps provider glyphs visible on %s', (surface) => {
    const failures = Object.keys(palette)
      .filter((token) => token.startsWith('provider-'))
      .map((token) => ({
        token,
        ratio: contrast(swatch(palette, token), swatch(palette, surface)),
      }))
      .filter(({ ratio }) => ratio < LARGE_FLOOR);
    expect(failures).toEqual([]);
  });

  it.each(READ_SURFACES)('keeps the soft border visible on %s', (surface) => {
    const floor = surface === 'elevated' || surface === 'floating' ? 1.3 : 1.2;
    const parent = swatch(palette, surface);
    const soft = readTranslucent({ block, token: 'border-soft' });
    const painted = composite({ foreground: soft.rgb, background: parent, alpha: soft.alpha });
    expect(contrast(painted, parent)).toBeGreaterThanOrEqual(floor);
  });

  it.each(READ_SURFACES)('draws the box border above the soft border on %s', (surface) => {
    const parent = swatch(palette, surface);
    const edgeContrast = ({ token }: { token: string }): number => {
      const edge = readTranslucent({ block, token });
      return contrast(
        composite({ foreground: edge.rgb, background: parent, alpha: edge.alpha }),
        parent,
      );
    };
    expect(edgeContrast({ token: 'border' })).toBeGreaterThan(
      edgeContrast({ token: 'border-soft' }),
    );
  });

  it.each(READ_SURFACES)('keeps the strong border at 4.5:1 on %s', (surface) => {
    expect(
      contrast(swatch(palette, 'border-strong'), swatch(palette, surface)),
    ).toBeGreaterThanOrEqual(BODY_FLOOR);
  });

  it.each(READ_SURFACES)('keeps idle marks at 3:1 on %s', (surface) => {
    expect(contrast(swatch(palette, 'idle'), swatch(palette, surface))).toBeGreaterThanOrEqual(
      LARGE_FLOOR,
    );
  });

  it.each(READ_SURFACES)('keeps the focus ring visible at 3:1 on %s', (surface) => {
    expect(
      contrast(swatch(palette, 'focus-ring'), swatch(palette, surface)),
    ).toBeGreaterThanOrEqual(LARGE_FLOOR);
  });

  it.each(TONES)('keeps the %s label readable on its solid and on its solid hover', (tone) => {
    const label = swatch(palette, `on-${tone}`);
    expect(contrast(label, swatch(palette, `${tone}-solid`))).toBeGreaterThanOrEqual(BODY_FLOOR);
    expect(contrast(label, swatch(palette, `${tone}-solid-hover`))).toBeGreaterThanOrEqual(
      BODY_FLOOR,
    );
  });

  it.each(TONES)('moves the %s solid when the pointer is on it', (tone) => {
    expect(
      contrast(swatch(palette, `${tone}-solid`), swatch(palette, `${tone}-solid-hover`)),
    ).toBeGreaterThan(1);
  });

  it('keeps primary inside the 200-275 hue band', () => {
    const css = readFileSync(STYLES, 'utf8');
    const hues = [...css.matchAll(/--color-primary:\s*oklch\([\d.]+\s+[\d.]+\s+([\d.]+)/g)];
    expect(hues).toHaveLength(2);
    for (const [, hue] of hues) {
      expect(Number(hue)).toBeGreaterThanOrEqual(200);
      expect(Number(hue)).toBeLessThanOrEqual(275);
    }
  });
});

describe.each(Object.entries(readLabThemes()))('%s oklab separation', (_theme, labs) => {
  it('keeps every tone pair apart in oklab', () => {
    const failures = TONES.flatMap((first, index) =>
      TONES.slice(index + 1).map((second) => ({
        pair: `${first}-${second}`,
        distance: deltaE({
          first: lab({ labs, token: first }),
          second: lab({ labs, token: second }),
        }),
      })),
    ).filter(({ distance }) => distance < TONE_SEPARATION);
    expect(failures).toEqual([]);
  });

  it('keeps every identity colour apart from every tone', () => {
    const identities = Object.keys(labs).filter((token) => token.startsWith('identity-'));
    expect(identities).toHaveLength(8);
    const failures = identities
      .flatMap((identity) =>
        TONES.map((tone) => ({
          pair: `${identity}-${tone}`,
          distance: deltaE({
            first: lab({ labs, token: identity }),
            second: lab({ labs, token: tone }),
          }),
        })),
      )
      .filter(({ distance }) => distance < IDENTITY_SEPARATION);
    expect(failures).toEqual([]);
  });
});

describe('surface ladder', () => {
  const labs = readLabThemes();
  const palettes = readThemes();
  const blocks = themeBlocks();
  const lightness = ({ theme, token }: { theme: 'dark' | 'light'; token: string }): number =>
    lab({ labs: labs[theme], token })[0];
  const step = ({
    theme,
    lower,
    upper,
  }: {
    theme: 'dark' | 'light';
    lower: string;
    upper: string;
  }): number => contrast(swatch(palettes[theme], lower), swatch(palettes[theme], upper));

  it('orders the ladder by depth', () => {
    const darkLevels = SURFACES.map((token) => lightness({ theme: 'dark', token }));
    darkLevels.slice(1).forEach((level, index) => {
      expect(level).toBeGreaterThan(Number(darkLevels[index]));
    });
    SURFACES.slice(1).forEach((upper, index) => {
      expect(step({ theme: 'dark', lower: String(SURFACES[index]), upper })).toBeGreaterThanOrEqual(
        STEP_FLOOR,
      );
    });

    const light = (token: string): number => lightness({ theme: 'light', token });
    expect(light('chrome')).toBeLessThan(light('background'));
    expect(light('background')).toBeLessThan(light('elevated'));
    expect(light('elevated')).toBeLessThanOrEqual(light('floating'));
    expect(light('background')).toBeGreaterThan(light('subtle'));
    expect(light('subtle')).toBeGreaterThan(light('muted'));
    const lightPairs = [
      ['chrome', 'background'],
      ['background', 'elevated'],
      ['background', 'subtle'],
      ['subtle', 'muted'],
    ] as const;
    lightPairs.forEach(([lower, upper]) => {
      expect(step({ theme: 'light', lower, upper })).toBeGreaterThanOrEqual(STEP_FLOOR);
    });
  });

  it.each(['dark', 'light'] as const)(
    'keeps the drawer surface one quiet step below the page in %s, never louder or tinted',
    (theme) => {
      const level = (token: string): number => lightness({ theme, token });
      expect(level('drawer')).toBeGreaterThan(level('chrome'));
      expect(level('drawer')).toBeLessThan(level('background'));
      expect(step({ theme, lower: 'drawer', upper: 'background' })).toBeGreaterThanOrEqual(
        DRAWER_STEP_FLOOR,
      );
      expect(step({ theme, lower: 'chrome', upper: 'drawer' })).toBeGreaterThanOrEqual(1.01);
      const chroma = (token: string): number =>
        Math.hypot(...lab({ labs: labs[theme], token }).slice(1));
      expect(chroma('drawer')).toBeLessThanOrEqual(chroma('background') + 0.001);
    },
  );

  it('keeps floating above raised', () => {
    expect(lightness({ theme: 'dark', token: 'floating' })).toBeGreaterThanOrEqual(
      lightness({ theme: 'dark', token: 'elevated' }),
    );
    expect(lightness({ theme: 'light', token: 'floating' })).toBeGreaterThanOrEqual(
      lightness({ theme: 'light', token: 'elevated' }),
    );
    expect(readShadow({ block: blocks.light, name: 'lg' })).not.toEqual(
      readShadow({ block: blocks.light, name: 'sm' }),
    );
  });

  it.each(['xs', 'sm', 'md', 'lg', 'xl'])(
    'lets shadow-%s follow the theme instead of the inlined dark value',
    (name) => {
      expect(blocks.dark).toContain(`--shadow-${name}: var(--elevation-${name});`);
      expect(readShadow({ block: blocks.light, name })).not.toEqual(
        readShadow({ block: blocks.dark, name }),
      );
    },
  );

  it.each([
    { theme: 'dark', block: blocks.dark, direction: 1 },
    { theme: 'light', block: blocks.light, direction: -1 },
  ] as const)(
    'steps fill one level inside every surface in $theme',
    ({ theme, block, direction }) => {
      const fill = readTranslucent({ block, token: 'fill' });
      const failures = READ_SURFACES.map((surface) => {
        const parent = swatch(palettes[theme], surface);
        const filled = composite({ foreground: fill.rgb, background: parent, alpha: fill.alpha });
        return {
          surface,
          direction: Math.sign(relativeLuminance(filled) - relativeLuminance(parent)),
          ratio: contrast(filled, parent),
        };
      }).filter((result) => result.direction !== direction || result.ratio < FILL_FLOOR);
      expect(failures).toEqual([]);
    },
  );
});

type OverlayFloor = {
  readonly token: string;
  readonly surfaces: ReadonlyArray<string>;
  readonly floor: number;
};

const OVERLAY_FLOORS: ReadonlyArray<OverlayFloor> = [
  { token: 'border-control', surfaces: READ_SURFACES, floor: LARGE_FLOOR },
  { token: 'border', surfaces: READ_SURFACES, floor: BOX_BORDER_FLOOR },
  { token: 'frame-edge', surfaces: ['chrome', 'background'], floor: 1.2 },
  { token: 'scrollbar-thumb', surfaces: ['background', 'subtle', 'floating'], floor: 1.8 },
  { token: 'scrollbar-thumb-active', surfaces: ['background', 'subtle', 'floating'], floor: 3 },
];

describe('translucent edges and thumbs', () => {
  const palettes = readThemes();
  const blocks = themeBlocks();
  const themes = [
    { theme: 'dark', block: blocks.dark },
    { theme: 'light', block: blocks.light },
  ] as const;

  it.each(
    themes.flatMap(({ theme, block }) =>
      OVERLAY_FLOORS.map((overlay) => ({ theme, block, ...overlay })),
    ),
  )(
    'keeps $token at $floor:1 over its surfaces in $theme',
    ({ theme, block, token, surfaces, floor }) => {
      const overlay = readTranslucent({ block, token });
      const failures = surfaces
        .map((surface) => {
          const parent = swatch(palettes[theme], surface);
          const painted = composite({
            foreground: overlay.rgb,
            background: parent,
            alpha: overlay.alpha,
          });
          return { surface, ratio: contrast(painted, parent) };
        })
        .filter(({ ratio }) => ratio < floor);
      expect(failures).toEqual([]);
    },
  );
});

const UI_SOURCE = join(__dirname, '..', '..', '..', '..', '..', 'packages', 'ui', 'src');
const TINT_SOURCE = join(UI_SOURCE, 'tint.ts');
const CHIP_SOURCE = join(UI_SOURCE, 'components', 'Chip.tsx');
const SELECTED_ROW_SOURCE = join(UI_SOURCE, 'selectedRow.ts');
const SELECTED_ROW_TEXT = ['foreground', 'muted-foreground'] as const;

describe('composed contrast', () => {
  const palettes = readThemes();
  const blocks = themeBlocks();
  const themes = [
    { theme: 'dark', block: blocks.dark },
    { theme: 'light', block: blocks.light },
  ] as const;
  const cases = themes.flatMap(({ theme, block }) =>
    READ_SURFACES.map((surface) => ({ theme, block, surface })),
  );

  it('never paints a stronger tint at hover: a tone hover is the neutral overlay', () => {
    const tint = readFileSync(TINT_SOURCE, 'utf8');
    const hoverFills = [...tint.matchAll(/hoverBg: '([^']+)'/g)].map((match) => String(match[1]));
    expect(new Set(hoverFills)).toEqual(new Set(['hover:bg-hover']));
  });

  it('keeps a tinted chip on its rest fill at hover, so its text keeps the rest contrast', () => {
    const chip = readFileSync(CHIP_SOURCE, 'utf8');
    expect(chip).not.toMatch(/tint\.hoverBg/);
    expect(chip).toMatch(/tint\.hoverRing/);
  });

  it.each(cases)(
    'keeps the text of a selected row at 4.5:1 over $surface in $theme',
    ({ theme, block, surface }) => {
      const palette = palettes[theme];
      const selected = readTranslucent({ block, token: 'overlay-selected' });
      const selectedFill = composite({
        foreground: selected.rgb,
        background: swatch(palette, surface),
        alpha: selected.alpha,
      });
      const failures = SELECTED_ROW_TEXT.map((token) => ({
        token,
        ratio: contrast(swatch(palette, token), selectedFill),
      })).filter(({ ratio }) => ratio < BODY_FLOOR);
      expect(failures).toEqual([]);
    },
  );

  it('adds no hover wash on top of a selected row', () => {
    const selectedRow = readFileSync(SELECTED_ROW_SOURCE, 'utf8');
    expect(selectedRow).toContain('data-[selected=true]:hover:bg-selected');
  });

  it('lifts faint text to muted inside a selected row', () => {
    const css = readFileSync(STYLES, 'utf8');
    expect(css).toMatch(
      /\[data-selected='true'\] \.text-faint-foreground\s*\{\s*color: var\(--color-muted-foreground\);\s*\}/,
    );
  });
});
