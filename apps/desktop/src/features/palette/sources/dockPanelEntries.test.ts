import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { dockFitProbe } from '@goodboy/ui';
import type { TerminalTabId } from '../../../shared/types/terminal';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { EMPTY_DRAWER_GRID, type DrawerGrid } from '../../../store/slices/drawer/state';
import { dockPanelEntries } from './dockPanelEntries';

const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });

const GRID: DrawerGrid = {
  ...EMPTY_DRAWER_GRID,
  columns: [
    [
      {
        kind: 'terminal',
        sessionId: null,
        payload: { terminalId: brandId<TerminalTabId>({ value: 'tab-harborline-dev' }) },
      },
    ],
    [{ kind: 'browser', sessionId: SESSION, payload: null }],
  ],
};

const moveDockPanel = vi.fn(async () => true);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  moveDockPanel.mockClear();
  useAppStore.setState({ drawerGrid: GRID, moveDockPanel });
});

const firstMove = () => {
  const root = dockPanelEntries({ grid: GRID, sessionId: SESSION }).find(
    (entry) => entry.key === 'dock-move:terminal',
  );
  const entry = root?.step?.()?.entries[0];
  if (entry === undefined) {
    throw new Error('the terminal has a move');
  }
  return entry;
};

describe('the move steps of the palette', () => {
  it('runs a move that still fits', () => {
    firstMove().run();

    expect(moveDockPanel).toHaveBeenCalledTimes(1);
  });

  it('drops a retained move once the window no longer has room for it', () => {
    const entry = firstMove();
    const release = dockFitProbe.publish({ probe: () => false });

    entry.run();
    release();

    expect(moveDockPanel).not.toHaveBeenCalled();
  });
});
