// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => bridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { APP_SECTIONS } from '../../../features/settings/components/SettingsStudio/appSections';
import { ALL_ROWS, ROW_FILES, ROW_SUFFIX, STUDIO_KINDS } from './allRows';
import {
  type BridgeArgs,
  CRUMB_ROWS,
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

const declaredTokens = (): Set<string> => new Set(ALL_ROWS.flatMap((row) => row.covers));

const readSource = (path: string): string => readFileSync(join(SRC, path), 'utf8');

const OVERLAY_OPENERS = Array.from(
  new Set(
    namesIn({
      source: readSource('app/hooks/useAppOverlays/index.ts'),
      pattern: /^\s+(open[A-Z]\w*)[,:]/gm,
    }),
  ),
).sort();

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
  openMountRequest:
    'the registry verb behind the pull request link of the retired Overview mount rows; the worktree level entry opens the page through navigate',
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
      .filter((element) => element.closest('[inert]') === null)
      .filter((element) => element.closest('[data-column-sessions]') === null)
      .filter((element) => element.closest('[data-session-level]') === null)
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
    const declared = declaredTokens();
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
    const declared = declaredTokens();
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
    const declared = declaredTokens();
    await boot({ seed: 'pr' });
    const pages = document.querySelector<HTMLElement>(
      '[data-level-layer="session"] [data-testid="session-pages"]',
    );
    expect(pages).not.toBeNull();
    const crumbs = within(pages ?? document.body)
      .getAllByRole('button')
      .map((item) => {
        const text = (item.textContent ?? '').trim();
        const known = CRUMB_ROWS.find((row) => text.startsWith(row.label));
        return `crumb:${known?.label ?? text}`;
      });
    await clickButton(/^Search or run \(/);
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
          ) &&
          !/^Theme: (dark|light|system)$/.test(label) &&
          !/^Use the (new|classic) session overview/.test(label),
      )
      .map((label) => `palette:${label.replace(/(Ctrl|⌘).*$/, '').trim()}`);

    expect(crumbs.length).toBeGreaterThan(0);
    expect(destinations.length).toBeGreaterThan(0);
    expect([...crumbs, ...destinations].filter((token) => !declared.has(token))).toEqual([]);
  }, 30_000);
});
