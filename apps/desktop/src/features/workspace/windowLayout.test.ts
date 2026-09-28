import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({ settings: new Map<string, string>() }));

vi.mock('@goodboy/db', () => ({
  setSetting: vi.fn(async (_db: unknown, key: string, value: string) => {
    h.settings.set(key, value);
  }),
  deleteSetting: vi.fn(async (_db: unknown, key: string) => {
    h.settings.delete(key);
  }),
  listSettingsWithPrefix: vi.fn(async (_db: unknown, prefix: string) =>
    [...h.settings.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ key, value })),
  ),
}));
vi.mock('../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { listWindowLayouts, parseLocation, saveWindowLayout } from './windowLayout';

const WS = 'ws-harborline' as WorkspaceId;
const DAY_MS = 24 * 60 * 60 * 1000;
const BOARD = {
  workspaceId: WS,
  place: { at: 'board' as const },
  studio: null,
  focus: { drawer: null, selection: {}, scroll: {}, revealed: [] },
};

beforeEach(() => {
  h.settings.clear();
});

describe('windowLayout', () => {
  it('keeps the readable parts of a focus and drops the rest', () => {
    expect(
      parseLocation({
        value: {
          place: { at: 'board' },
          studio: null,
          focus: { scroll: { queue: 12, bad: 'x' }, selection: { thread: 't1' }, revealed: [3] },
        },
      }),
    ).toEqual({
      workspaceId: null,
      place: { at: 'board' },
      studio: null,
      focus: { drawer: null, selection: { thread: 't1' }, scroll: { queue: 12 }, revealed: [] },
    });
    expect(parseLocation({ value: { place: { at: 'session' } } })).toBeNull();
  });

  it('lists the windows saved in the last month', async () => {
    const nowMs = Date.now();
    await saveWindowLayout({ label: 'main', workspaceId: WS, location: BOARD, at: nowMs });
    await saveWindowLayout({
      label: 'win-old',
      workspaceId: WS,
      location: BOARD,
      at: nowMs - 40 * DAY_MS,
    });
    h.settings.set('window.layout.win-broken', '{');

    const layouts = await listWindowLayouts({ nowMs });

    expect(layouts.map((layout) => layout.label)).toEqual(['main']);
    expect(layouts[0]?.location).toEqual(BOARD);
  });
});
