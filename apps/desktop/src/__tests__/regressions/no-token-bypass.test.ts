import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SOURCE_ROOTS = [
  join(REPO_ROOT, 'apps', 'desktop', 'src'),
  join(REPO_ROOT, 'packages', 'ui', 'src'),
];
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist']);

type Rule = {
  readonly pattern: RegExp;
  readonly allow: ReadonlyArray<string>;
  readonly why: string;
};

const NO_ALLOW: ReadonlyArray<string> = [];
const TONE_ALPHA_ALLOW = ['packages/ui/src/tint.ts', 'packages/ui/src/components/Button.tsx'];

const RULES = [
  {
    pattern: /(?:text|placeholder:text)-(?:muted-)?foreground\/\d+/,
    allow: NO_ALLOW,
    why: 'text hierarchy uses foreground, muted, faint or disabled tokens without opacity',
  },
  {
    pattern:
      /focus-visible:ring-1(?!\d)|focus-visible:ring-\[|focus-(?:visible|within):ring-primary\/\d+/,
    allow: NO_ALLOW,
    why: 'focus treatment uses the two-pixel focus-ring token',
  },
  {
    pattern:
      /(?:bg|text|border|ring|divide)-(?:primary|info|success|warning|danger|merged|draft)\/(?:\d+|\[[^\]]+\])/,
    allow: TONE_ALPHA_ALLOW,
    why: 'tone alpha is owned by tintClasses and solid button hover treatment',
  },
  {
    pattern: /hover:bg-(?:muted(?:\/(?:\d+|\[[^\]]+\]))?|foreground\/(?:\d+|\[[^\]]+\]))/,
    allow: NO_ALLOW,
    why: 'interactive hover surfaces use the shared hover overlay',
  },
  {
    pattern:
      /(?:bg-(?:muted|subtle|background|elevated|foreground)|(?:bg|border)-(?:muted|faint|disabled)-foreground|border-foreground|border-soft|divide-border-soft)\/(?:\d+|\[[^\]]+\])|bg-(?:black|white)\/|shadow-2xl|rgba\(/,
    allow: NO_ALLOW,
    why: 'neutral surfaces use the opaque ramp or named overlays and shadows',
  },
  {
    pattern:
      /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|divide|shadow|caret|accent)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/,
    allow: NO_ALLOW,
    why: 'colour comes from theme tokens, never the raw Tailwind palette',
  },
  {
    pattern: /\b(?:LoaderCircle|Loader2|animate-spin)\b/,
    allow: NO_ALLOW,
    why: 'spinners are forbidden: loading is a skeleton, running is a moving border',
  },
  {
    pattern: /\banimate-(?:pulse|ping)\b/,
    allow: ['packages/ui/src/components/Skeleton.tsx'],
    why: 'standing motion is the registered soft pulse; only the skeleton pulses to load',
  },
  {
    pattern: /\bz-\[/,
    allow: NO_ALLOW,
    why: 'global layers use the named z-index tokens',
  },
  {
    pattern:
      /^(?=.*\bz-(?:popover|toast|command-palette)(?![\w-]))(?=.*(?<![\w:-])bg-(?!(?:floating|hover|selected|transparent)(?![\w-])))/,
    allow: NO_ALLOW,
    why: 'floating layers sit on the floating surface',
  },
  {
    pattern: /(?<![\w-])(?:bg|from|via|to)-chrome(?![\w-])/,
    allow: [
      'packages/ui/src/components/AppShell.tsx',
      'apps/desktop/src/app/components/AppTopBar/index.tsx',
      'apps/desktop/src/app/components/AppFooter/index.tsx',
    ],
    why: 'the chrome surface frames the app: the shell, its sidebar column, the top bar and the footer',
  },
  {
    pattern: /\bduration-\[/,
    allow: NO_ALLOW,
    why: 'durations use the numeric scale, never an arbitrary value',
  },
  {
    pattern:
      /(?<![\w:$.{-])rounded(?=['"`]|\s+(?:[\w:[\]/.-]*-[\w\]/.-]|border\b|flex\b|block\b|grid\b|truncate\b|inline\b|hidden\b|shadow\b|relative\b|absolute\b|transition\b))|\brounded-\[/,
    allow: NO_ALLOW,
    why: 'radius comes from the sm, md, lg and full steps',
  },
  {
    pattern:
      /(?<![\w&#])#(?=[0-9a-fA-F]*[a-fA-F])(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/,
    allow: [
      'apps/desktop/src/shared/components/GenericTerminalPanel/terminal-theme.ts',
      'apps/desktop/src/features/wireframes/wireframePalette.ts',
      'apps/desktop/src/app/components/MockScene/scenes/artifactSeed.ts',
      'apps/desktop/src/app/components/MockScene/scenes/InboxScene.tsx',
    ],
    why: 'raw colour lives only in the xterm, wireframe and seeded label quarantines',
  },
] satisfies ReadonlyArray<Rule>;

const listSourceFiles = ({ dir, files = [] }: { dir: string; files?: string[] }): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles({ dir: full, files });
      continue;
    }
    if (entry.includes('.test.')) {
      continue;
    }
    if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
};

const STYLES = join(REPO_ROOT, 'apps', 'desktop', 'src', 'styles.css');
const COLOR_CLASS =
  /(?<![\w\-,[])((?:[\w-]+:)*)(bg|text|border|ring|divide|fill|stroke)-(?:(?:[trblxyse])-)?([a-z][a-z0-9-]*)(?:\/[\w.[\]]+)?(?![\w-])/g;
const BORDER_SIDE = /^[trblxyse](?:-\d+)?$/;
const COLOR_KEYWORDS = new Set([
  'current',
  'transparent',
  'inherit',
  'white',
  'black',
  'none',
  'image',
  'gradient-to-t',
  'gradient-to-r',
  'gradient-to-b',
  'gradient-to-l',
  'xs',
  'sm',
  'base',
  'lg',
  'xl',
  'left',
  'center',
  'right',
  'ellipsis',
  'dashed',
  'dotted',
  'solid',
  'collapse',
  'box',
  'inset',
]);

const definedColorNames = (): ReadonlySet<string> => {
  const css = readFileSync(STYLES, 'utf8');
  const tokens = [...css.matchAll(/--color-([a-z0-9-]+):/g)].map((match) => String(match[1]));
  const utilities = [...css.matchAll(/(?:@utility\s+|^\.)[a-z]+-([a-z0-9-]+)\s*\{/gm)].map(
    (match) => String(match[1]),
  );
  return new Set([...tokens, ...utilities, ...COLOR_KEYWORDS]);
};

describe('token boundaries', () => {
  it('resolves every colour class to a defined token', () => {
    const defined = definedColorNames();
    const offenders: string[] = [];
    for (const root of SOURCE_ROOTS) {
      for (const file of listSourceFiles({ dir: root })) {
        const path = relative(REPO_ROOT, file).split(sep).join('/');
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, index) => {
            for (const match of line.matchAll(COLOR_CLASS)) {
              const name = String(match[3]);
              if (!defined.has(name) && !BORDER_SIDE.test(name)) {
                offenders.push(`${path}:${index + 1} ${match[2]}-${name}`);
              }
            }
          });
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it.each(RULES)('$why', ({ pattern, allow }) => {
    const offenders: string[] = [];
    for (const root of SOURCE_ROOTS) {
      for (const file of listSourceFiles({ dir: root })) {
        const path = relative(REPO_ROOT, file).split(sep).join('/');
        if (allow.includes(path)) {
          continue;
        }
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, index) => {
            if (pattern.test(line)) {
              offenders.push(`${path}:${index + 1} ${line.trim()}`);
            }
          });
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
