// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => bridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { readFileSync } from 'fs';
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
import { LENS_ENTRY_ROWS } from './lens-entries.rows';
import { PALETTE_DESTINATION_ROWS } from './palette-destinations.rows';
import { FOOTER_AND_VERB_ROWS } from './footer-and-verbs.rows';
import { SETTINGS_AND_MOUNT_ROWS } from './settings-and-mounts.rows';
import { PULL_REQUEST_LAYER_ROWS } from './pull-request-layers.rows';
import { CREATE_AND_SEARCH_ROWS } from './create-and-search.rows';

installNavigationHooks();

const ALL_ROWS: ReadonlyArray<Row> = [
  ...LENS_ENTRY_ROWS,
  ...PALETTE_DESTINATION_ROWS,
  ...FOOTER_AND_VERB_ROWS,
  ...SETTINGS_AND_MOUNT_ROWS,
  ...PULL_REQUEST_LAYER_ROWS,
  ...CREATE_AND_SEARCH_ROWS,
];

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
    /SettingsStudioScope =([^;]+);/.exec(
      readSource('features/settings/components/SettingsStudio/types.ts'),
    )?.[1] ?? '',
  pattern: /'(\w+)'/g,
});

const EXEMPT: Readonly<Record<string, string>> = {
  openDrawer: 'generic drawer primitive, reached through openContextDrawer',
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
};

const declared = new Set(ALL_ROWS.flatMap((row) => row.covers));

describe('navigation flow table ratchet', () => {
  it('has a row for every navigation action of the store and the app overlays', () => {
    const missing = [...STORE_ACTIONS, ...OVERLAY_OPENERS].filter(
      (name) => !declared.has(name) && EXEMPT[name] === undefined,
    );
    expect(missing).toEqual([]);
    const stale = Object.keys(EXEMPT).filter(
      (name) => ![...STORE_ACTIONS, ...OVERLAY_OPENERS].includes(name) || declared.has(name),
    );
    expect(stale).toEqual([]);
  });

  it('has a row for every studio, settings scope and app settings section', () => {
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
    await boot({ seed: 'pr' });
    await clickButton(/^Overview/);
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
