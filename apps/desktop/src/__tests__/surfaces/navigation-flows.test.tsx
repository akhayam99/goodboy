// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string) => bridge(command)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { BranchCommit, WorktreeStatus } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { sessionPlace } from '../../store/slices/navigation/place';
import { seedSessionWithMounts } from '../helpers/seedSessionWithMounts';
import { ToastProvider } from '../../app/components/Toast';
import { KeepAliveWorkSurface } from '../../app/components/KeepAliveWorkSurface';

const COMMITS: ReadonlyArray<BranchCommit> = [
  {
    sha: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
    shortSha: 'b2c3d4e',
    subject: 'Keep trailing-comma rows in the ledger-core importer',
    author: 'Robin Vale',
    timestamp: 1_787_900_000,
    pushed: false,
    parentSha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
  },
  {
    sha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
    shortSha: 'a1b2c3d',
    subject: 'Add a failing importer fixture',
    author: 'Robin Vale',
    timestamp: 1_787_890_000,
    pushed: false,
    parentSha: null,
  },
];

const STATUS: WorktreeStatus = {
  branch: 'ak/importer-trailing-comma',
  head: COMMITS[0]?.sha ?? null,
  headSubject: COMMITS[0]?.subject ?? null,
  upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
  mainDistance: { kind: 'known', ahead: 2, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: null,
  inProgress: null,
};

const BRIDGE: Readonly<Record<string, unknown>> = {
  worktree_commits: COMMITS,
  worktree_status: STATUS,
  worktree_diff: '',
};

const bridge = (command: string): Promise<unknown> =>
  command in BRIDGE ? Promise.resolve(BRIDGE[command]) : new Promise<never>(() => undefined);

const LOOP_MARKERS = ['Maximum update depth', '#185', 'getSnapshot should be cached'];

let useAppStore: StoryStore;
let consoleErrors: Array<string> = [];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  consoleErrors = [];
  vi.spyOn(console, 'error').mockImplementation((...args: ReadonlyArray<unknown>) => {
    consoleErrors.push(args.map(String).join(' '));
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mount = async (ui: ReactNode): Promise<void> => {
  render(<ToastProvider>{ui}</ToastProvider>);
  await settle();
};

const expectNoRenderLoop = (): void => {
  expect(
    consoleErrors.filter((line) => LOOP_MARKERS.some((marker) => line.includes(marker))),
  ).toEqual([]);
};

describe('navigation entries render their destination', () => {
  it('opens rewrite history from the diff', async () => {
    const sessionId = seedSessionWithMounts({ useAppStore });
    await mount(<KeepAliveWorkSurface sessionId={sessionId} isActive />);
    await act(async () => {
      useAppStore.getState().navigate({ to: sessionPlace({ sessionId, lens: 'files' }) });
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    fireEvent.click(await screen.findByRole('button', { name: /Rewrite history/ }));
    await settle();

    expect(screen.getByRole('heading', { name: 'Rewrite history' })).toBeDefined();
    expectNoRenderLoop();
  });
});
