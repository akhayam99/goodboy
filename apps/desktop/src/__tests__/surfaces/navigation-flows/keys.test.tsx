// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => keysBridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: class {
    activate = (): void => undefined;
    dispose = (): void => undefined;
    onContextLoss = (): { dispose: () => void } => ({ dispose: () => undefined });
  },
}));
vi.mock('@tauri-apps/api/webview', async () => {
  const { zoomFactors } = await import('./keys.effects');
  return {
    getCurrentWebview: () => ({
      setZoom: async (factor: number) => {
        zoomFactors.push(factor);
      },
    }),
  };
});
vi.mock('../../../features/workspace/window', async (importOriginal) => {
  const { spawnedWindows } = await import('./keys.effects');
  return {
    ...(await importOriginal<typeof import('../../../features/workspace/window')>()),
    spawnWorkspaceWindow: async (id: string) => {
      spawnedWindows.push(id);
    },
  };
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { screen } from '@testing-library/react';
import { SHORTCUTS } from '../../../shared/keyboard/registry';
import { installNavigationHooks, runNavigationRows, type BridgeArgs } from './harness';
import { reloads, worldDatabase, zoomFactors } from './keys.effects';
import {
  KEY_ROWS,
  MORE_KEY_ROWS,
  SESSION_KEY_ROWS,
  WORLD_ROWS,
  bootWorld,
  keysBridge,
} from './keys.rows';

installNavigationHooks();

beforeEach(() => {
  vi.mocked(invoke).mockClear();
  reloads.length = 0;
  zoomFactors.length = 0;
  worldDatabase.answersEmpty = false;
  localStorage.clear();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: () => reloads.push(1), hash: '' },
  });
});

const ALL_ROWS = [...KEY_ROWS, ...MORE_KEY_ROWS, ...SESSION_KEY_ROWS];

runNavigationRows({ rows: ALL_ROWS });

describe('keys pressed on a seeded world of the real app', () => {
  it.each(WORLD_ROWS.map((row) => [row.name, row] as const))(
    '%s',
    async (_name, row) => {
      await bootWorld({ world: row.world });
      await row.open();
      await row.lands();
      expect(screen.queryByText('Something went wrong')).toBeNull();
    },
    30_000,
  );
});

const EXEMPT: Readonly<Record<string, string>> = {
  'review.accept':
    'accepting integrates the ready candidate through the worktree command, which the bridge does not answer; the store tests of the resolve slice cover the acceptance',
};

const MAX_EXEMPT = 1;

const covered = new Set([...ALL_ROWS, ...WORLD_ROWS].flatMap((row) => row.covers));

describe('every shortcut of the registry is pressed on the real app', () => {
  const ids = Object.keys(SHORTCUTS);

  it('has a row for every id, or a reason in the exemption list', () => {
    const missing = ids.filter((id) => !covered.has(`key:${id}`) && EXEMPT[id] === undefined);
    expect(missing).toEqual([]);
  });

  it('never exempts an id that has a row, or an id that does not exist', () => {
    const stale = Object.keys(EXEMPT).filter((id) => covered.has(`key:${id}`) || !ids.includes(id));
    expect(stale).toEqual([]);
  });

  it('only lets the exemption list shrink', () => {
    expect(Object.keys(EXEMPT).length).toBeLessThanOrEqual(MAX_EXEMPT);
  });

  it('gives every exemption a reason', () => {
    expect(Object.values(EXEMPT).filter((reason) => reason.trim().length < 10)).toEqual([]);
  });
});
