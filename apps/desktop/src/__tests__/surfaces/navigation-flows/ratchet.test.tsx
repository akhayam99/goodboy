// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => bridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { APP_SECTIONS } from '../../../features/settings/components/SettingsStudio/appSections';
import {
  type BridgeArgs,
  LENS_ROWS,
  type Row,
  SRC,
  STORE_ACTIONS,
  boot,
  bridge,
  clickButton,
  installNavigationHooks,
  namesIn,
  settle,
  useAppStore,
} from './harness';
installNavigationHooks();

const ROW_SUFFIX = '.rows.tsx';
const ROW_FILES = readdirSync(__dirname)
  .filter((file) => file.endsWith(ROW_SUFFIX))
  .sort();

const loadAllRows = async (): Promise<ReadonlyArray<Row>> => {
  const modules = await Promise.all(
    ROW_FILES.map(
      async (file) =>
        (await import(`./${file.slice(0, -ROW_SUFFIX.length)}.rows`)) as Record<string, unknown>,
    ),
  );
  return modules.flatMap((mod) => Object.values(mod).flat() as ReadonlyArray<Row>);
};

const declaredTokens = async (): Promise<Set<string>> =>
  new Set((await loadAllRows()).flatMap((row) => row.covers));

const readSource = (path: string): string => readFileSync(join(SRC, path), 'utf8');

const OVERLAY_OPENERS = Array.from(
  new Set(
    namesIn({
      source: readSource('app/hooks/useAppOverlays/index.ts'),
      pattern: /^\s+(open[A-Z]\w*)[,:]/gm,
    }),
  ),
).sort();

const STUDIO_KINDS = namesIn({
  source: readSource('store/slices/navigation/studio.ts'),
  pattern: /\{ readonly kind: '(\w+)'/g,
});

const SETTINGS_SCOPES = namesIn({
  source:
    /SettingsStudioScope =([^;]+);/.exec(readSource('features/settings/settingsFocus.ts'))?.[1] ??
    '',
  pattern: /'(\w+)'/g,
});

const EXEMPT: Readonly<Record<string, string>> = {
  openWorkspace: 'focuses or opens another window, not a page in this one',
  openTerminal: 'adds a terminal tab to the dock, not a page',
  setActiveLens: 'internal to the navigation slice, the one door is navigate',
  openPalette: 'opens the palette overlay, every palette destination has its own row',
  openShortcutHelp: 'same page as the shortcuts settings row',
  up: 'leaves an agent overlay for its parent place, which the lens rows cover',
  openArtifactConversation: 'an effect of the artifact studio, no control calls it',
  openDiffLens: 'only resolver thread cards and the resolve publish strip call it',
  openResolveDiff: 'resolve queue control, covered by the resolve flows in main-flows',
  openStorageArtifact:
    'storage rows list artifacts read from disk, which the bridge mock has none of',
  openScribePullRequest: 'the engine pushing and opening the pull request, not a page',
};

const CHROME_TARGET_CEILING = 24;

const CHROME_ROOTS = [
  '[data-top-bar]',
  '[data-side-column] [data-column-layer="nav"]',
  '[data-slot="trail-bar"]',
];

const INTERACTIVE = 'button, a[href], input, [role="button"]';

const chromeTargets = (): ReadonlyArray<string> =>
  CHROME_ROOTS.flatMap((selector) => {
    const root = document.querySelector(selector);
    if (root === null) {
      return [];
    }
    return Array.from(root.querySelectorAll<HTMLElement>(INTERACTIVE))
      .filter((element) => element.closest('[data-column-sessions]') === null)
      .map((element) => element.getAttribute('aria-label') ?? element.textContent ?? '');
  });

describe('the frame holds at most 24 chrome targets on a session page', () => {
  it('counts the top bar, the column outside its sessions list and the trail', async () => {
    await boot({ seed: 'pr' });

    expect(document.querySelector('[data-side-column]')).not.toBeNull();
    expect(document.querySelector('[data-app-footer]')).toBeNull();
    const targets = chromeTargets();
    expect(targets.length, targets.join(' | ')).toBeLessThanOrEqual(CHROME_TARGET_CEILING);
    expect(targets.length).toBeGreaterThan(10);
  }, 30_000);

  it('counts more under the legacy layout, which is why the column replaces them', async () => {
    await boot({ seed: 'pr', bars: 'classic' });

    const classic = Array.from(
      document.querySelectorAll<HTMLElement>(
        `[data-top-bar] :is(${INTERACTIVE}), [data-app-footer] :is(${INTERACTIVE}), [data-slot="trail-bar"] :is(${INTERACTIVE})`,
      ),
    );
    expect(document.querySelector('[data-side-column]')).toBeNull();
    expect(classic.length).toBeGreaterThan(0);
  }, 30_000);
});

describe('navigation flow table ratchet', () => {
  it('runs every rows file from a test file of the same name', () => {
    expect(ROW_FILES.length).toBeGreaterThan(0);
    const unrun = ROW_FILES.filter((file) => {
      const name = file.slice(0, -ROW_SUFFIX.length);
      const testFile = join(__dirname, `${name}.test.tsx`);
      if (!existsSync(testFile)) {
        return true;
      }
      const source = readFileSync(testFile, 'utf8');
      return !source.includes('runNavigationRows') || !source.includes(`./${name}.rows`);
    });
    expect(unrun).toEqual([]);
  });

  it('has a row for every navigation action of the store and the app overlays', async () => {
    const declared = await declaredTokens();
    const missing = [...STORE_ACTIONS, ...OVERLAY_OPENERS].filter(
      (name) => !declared.has(name) && EXEMPT[name] === undefined,
    );
    expect(missing).toEqual([]);
    const stale = Object.keys(EXEMPT).filter(
      (name) => ![...STORE_ACTIONS, ...OVERLAY_OPENERS].includes(name) || declared.has(name),
    );
    expect(stale).toEqual([]);
  });

  it('has a row for every studio, settings scope and app settings section', async () => {
    const declared = await declaredTokens();
    expect(STUDIO_KINDS.length).toBeGreaterThan(0);
    expect(SETTINGS_SCOPES.length).toBeGreaterThan(0);
    const missing = [
      ...STUDIO_KINDS.map((kind) => `studio:${kind}`),
      ...SETTINGS_SCOPES.map((scope) => `scope:${scope}`),
      ...APP_SECTIONS.map((section) => `settings:${section.id}`),
    ].filter((token) => !declared.has(token));
    expect(missing).toEqual([]);
  });

  it('has a row for every crumb menu entry and palette destination', async () => {
    const declared = await declaredTokens();
    await boot({ seed: 'pr' });
    await clickButton(/^Session/);
    const crumbs = screen.getAllByRole('menuitemradio').map((item) => {
      const text = (item.textContent ?? '').trim();
      const known = LENS_ROWS.find((row) => text.startsWith(row.label));
      return `crumb:${known?.label ?? text}`;
    });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await settle();
    await clickButton(/^Search .+ \(/);
    const sessionGoals = new Set(useAppStore.getState().sessions.map((session) => session.goal));
    const workspaceNames = new Set(useAppStore.getState().workspaces.map((ws) => ws.name));
    const agentNames = new Set(
      Object.values(useAppStore.getState().sessionPhaseRuns)
        .flat()
        .map((agent) => agent.name),
    );
    const destinations = screen
      .getAllByRole('option')
      .map((option) => option.getAttribute('aria-label') ?? option.textContent ?? '')
      .filter(
        (label) =>
          ![...sessionGoals, ...workspaceNames, ...agentNames].some((name) =>
            label.startsWith(name),
          ) && !/^Switch to (light|dark) mode/.test(label),
      )
      .map((label) => `palette:${label.replace(/(Ctrl|⌘).*$/, '').trim()}`);

    expect(crumbs.length).toBeGreaterThan(0);
    expect(destinations.length).toBeGreaterThan(0);
    expect([...crumbs, ...destinations].filter((token) => !declared.has(token))).toEqual([]);
  }, 30_000);
});
