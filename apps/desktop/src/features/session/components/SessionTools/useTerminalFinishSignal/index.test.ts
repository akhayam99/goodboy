// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextSessionId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { trackTerminalInput } from '../../../../terminal/commandTracker';
import type { TerminalTab, TerminalTabId } from '../../../../../shared/types/terminal';
import { useTerminalFinishSignal } from '.';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const SESSION_ID = nextSessionId();
const TAB_ID: TerminalTabId = JSON.parse(JSON.stringify(`${SESSION_ID}::t1`));

const TAB: TerminalTab = {
  id: TAB_ID,
  owner: { kind: 'session', sessionId: SESSION_ID },
  title: 'zsh',
  cwd: '/w/ledger',
  status: 'running',
  createdAt: 0,
};

let useAppStore: StoryStore;
let live: ReadonlyArray<{
  readonly id: string;
  readonly cwd: string;
  readonly pid: number;
  readonly foregroundPid: number;
}> = [];

const BUSY = [{ id: TAB_ID, cwd: '/w/ledger', pid: 10, foregroundPid: 11 }];
const IDLE = [{ id: TAB_ID, cwd: '/w/ledger', pid: 10, foregroundPid: 10 }];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  live = IDLE;
  stubStoryInvoke({ terminal_list_live: async () => live });
  useAppStore.setState({ terminalTabs: { [SESSION_ID]: [TAB] } });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const mount = ({ isTerminalOpen = false }: { readonly isTerminalOpen?: boolean } = {}) =>
  renderHook(
    (props: { readonly isOpen: boolean }) =>
      useTerminalFinishSignal({ sessionId: SESSION_ID, isTerminalOpen: props.isOpen }),
    { initialProps: { isOpen: isTerminalOpen } },
  );

const runLongCommand = async (): Promise<void> => {
  live = BUSY;
  await advance(12_000);
  live = IDLE;
  await advance(3_000);
};

describe('useTerminalFinishSignal', () => {
  it('raises a dot when a command that ran over ten seconds ends while the drawer is closed', async () => {
    trackTerminalInput({ terminalId: TAB_ID, data: 'pnpm test\r' });
    const view = mount();
    await advance(0);
    expect(view.result.current).toBeNull();

    await runLongCommand();

    expect(view.result.current).toEqual({
      kind: 'changed',
      note: 'pnpm test finished after 12s',
    });
    expect(useAppStore.getState().terminalFinishes[SESSION_ID]?.terminalId).toBe(TAB_ID);
  });

  it('stays quiet for a command that ended within ten seconds', async () => {
    const view = mount();
    live = BUSY;
    await advance(3_000);

    live = IDLE;
    await advance(3_000);

    expect(view.result.current).toBeNull();
  });

  it('stays quiet while the drawer is open, because the person sees it end', async () => {
    const view = mount({ isTerminalOpen: true });

    await runLongCommand();

    expect(view.result.current).toBeNull();
  });

  it('clears the dot when the drawer opens', async () => {
    const view = mount();
    await runLongCommand();
    expect(view.result.current).not.toBeNull();

    view.rerender({ isOpen: true });

    expect(view.result.current).toBeNull();
    expect(useAppStore.getState().terminalFinishes[SESSION_ID]).toBeUndefined();
  });

  it('asks nothing when the session has no terminal', async () => {
    useAppStore.setState({ terminalTabs: {} });
    mount();

    await runLongCommand();

    expect(useAppStore.getState().terminalFinishes).toEqual({});
  });
});
