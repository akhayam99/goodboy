// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';
import { DRAWER_EXIT_MS } from '@goodboy/ui';

const DESKTOP_SRC = join(__dirname, '..', '..');
const UI_SRC = join(DESKTOP_SRC, '..', '..', '..', 'packages', 'ui', 'src');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist', 'MockScene']);

const GEOMETRY_OWNERS = new Set(['drawerGeometry.ts', join('components', 'DrawerColumn.tsx')]);
const GEOMETRY_NAMES =
  /\b(drawerLayoutOf|canDrawerPush|drawerModeOf|drawerWidthOf|COLUMN_MIN_PUSH)\b/;
const OWN_WIDTH_RULES = /\b(ResizeObserver|matchMedia|innerWidth|useMeasuredWidth)\b/;
const COLUMN_HOSTS = [
  join('app', 'components', 'StudioFrame', 'index.tsx'),
  join('features', 'inbox', 'components', 'InboxStudio', 'InboxStudioLayout.tsx'),
  join('features', 'workflows', 'components', 'WorkflowsPanel', 'index.tsx'),
  join('features', 'workspace-chat', 'components', 'ChatRoom', 'index.tsx'),
];

const isSource = (name: string): boolean =>
  /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts');

const listSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, acc);
    } else if (isSource(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

type Source = {
  readonly rel: string;
  readonly text: string;
};

const sourcesOf = (root: string): ReadonlyArray<Source> =>
  listSourceFiles(root).map((file) => ({
    rel: relative(root, file),
    text: readFileSync(file, 'utf8'),
  }));

const DESKTOP = sourcesOf(DESKTOP_SRC);
const UI = sourcesOf(UI_SRC);

const isDrawerFile = ({ rel }: Source): boolean =>
  rel.split(sep).some((segment) => segment.includes('Drawer'));

describe('the one drawer rule', () => {
  it('keeps the push or overlay decision inside drawerGeometry and DrawerColumn', () => {
    const owned = ({ rel }: Source): boolean => GEOMETRY_OWNERS.has(rel) || rel === 'index.ts';
    const offenders = [
      ...DESKTOP.map(({ rel, text }) => ({ rel: `desktop:${rel}`, text })),
      ...UI.filter((source) => !owned(source)).map(({ rel, text }) => ({ rel: `ui:${rel}`, text })),
    ]
      .filter(({ text }) => GEOMETRY_NAMES.test(text))
      .map(({ rel }) => rel);

    expect(
      offenders,
      `Only drawerGeometry.ts and DrawerColumn.tsx may decide push or overlay. Move this to DrawerColumn:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('gives no drawer file its own width rule', () => {
    const offenders = DESKTOP.filter(isDrawerFile)
      .filter(({ text }) => OWN_WIDTH_RULES.test(text))
      .map(({ rel }) => rel);

    expect(
      offenders,
      'A drawer never measures the window or a breakpoint; DrawerColumn does it for every drawer.',
    ).toEqual([]);
  });

  it('mounts DrawerColumn from AppShell and the known studio pane hosts only', () => {
    const hostsOf = (sources: ReadonlyArray<Source>): string[] =>
      sources
        .filter(({ text }) => /<DrawerColumn\b/.test(text))
        .map(({ rel }) => rel)
        .sort();

    expect(hostsOf(DESKTOP)).toEqual([...COLUMN_HOSTS].sort());
    expect(hostsOf(UI)).toEqual([join('components', 'AppShell.tsx')]);
  });

  it('mounts DrawerHost once, as the drawer slot of AppShell', () => {
    const mounts = DESKTOP.filter(({ text }) => /<DrawerHost\b/.test(text));

    expect(mounts.map(({ rel }) => rel)).toEqual(['App.tsx']);
    expect(mounts[0]?.text).toMatch(/drawer=\{[^}]*<DrawerHost \/>[^}]*\}/);
  });

  it('times the css exit of the overlay as long as the timer that keeps it mounted', () => {
    const css = readFileSync(join(DESKTOP_SRC, 'styles.css'), 'utf8');

    expect(css).toContain(`--duration-quick: ${DRAWER_EXIT_MS}ms`);
    expect(css).toContain('--animate-drawer-overlay-out: drawer-overlay-out var(--duration-quick)');
    expect(css).toContain('--animate-drawer-fade-out: drawer-fade-out var(--duration-quick)');
  });
});
