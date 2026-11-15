// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId, type FileDiff, type SessionId, type WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { captureWindowLocation } from '../../../../store/slices/navigation/captureWindowLocation';
import { branchPlace } from '../../../../store/slices/navigation/place';
import { parseLocation } from '../../../workspace/windowLayout';
import { useFilesReading } from '.';

const WS = brandId<WorkspaceId>({ value: 'ws-cascadia' });
const SESSION_ID = brandId<SessionId>({ value: 'session-notify-relay' });
const LEDGER = '/work/ledger-core';
const NOTIFY = '/work/notify-relay';
const CHANGED: FileDiff = {
  path: 'src/relay.ts',
  status: 'modified',
  additions: 1,
  deletions: 0,
  binary: false,
  hunks: [],
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const seed = () => {
  useAppStore.setState({
    currentWorkspaceId: WS,
    sessions: [aSession({ id: SESSION_ID })],
    navigation: {},
  });
};

beforeEach(async () => {
  await resetStoryStore();
  seed();
});

afterEach(cleanup);

type MountParams = {
  readonly worktreePath: string;
};

const readingOn = ({ worktreePath }: MountParams) =>
  renderHook(() =>
    useFilesReading({
      sessionId: SESSION_ID,
      worktreePath,
      review: { allFiles: [CHANGED], jumpTo: vi.fn() },
      dismissTree: vi.fn(),
    }),
  );

const ENTRY = {
  name: 'README.md',
  relPath: 'docs/README.md',
  isDir: false,
  sizeBytes: 120,
  modifiedAt: null,
};

describe('reading an unchanged file on All files', () => {
  it('reopens the file after a reload, on its own project only', async () => {
    useAppStore.getState().navigate({
      to: branchPlace({ sessionId: SESSION_ID, mountPath: NOTIFY, tab: 'files' }),
    });
    const first = readingOn({ worktreePath: NOTIFY });
    act(() => first.result.current.selectMode('all'));
    act(() => first.result.current.pickUnchanged(ENTRY));
    expect(first.result.current.openFile?.relPath).toBe('docs/README.md');
    const saved = parseLocation({
      value: JSON.parse(JSON.stringify(captureWindowLocation({ state: useAppStore.getState() }))),
    });
    first.unmount();

    await resetStoryStore();
    seed();
    await act(() => useAppStore.getState().restoreLocation({ location: saved! }));

    expect(readingOn({ worktreePath: NOTIFY }).result.current.openFile?.relPath).toBe(
      'docs/README.md',
    );
    expect(readingOn({ worktreePath: LEDGER }).result.current.openFile).toBeNull();
  });

  it('forgets the file when the reader goes back to the changes', () => {
    useAppStore.getState().navigate({
      to: branchPlace({ sessionId: SESSION_ID, mountPath: NOTIFY, tab: 'files' }),
    });
    const { result } = readingOn({ worktreePath: NOTIFY });
    act(() => result.current.selectMode('all'));
    act(() => result.current.pickUnchanged(ENTRY));
    act(() => result.current.backToChanges());

    expect(result.current.openFile).toBeNull();
    const saved = captureWindowLocation({ state: useAppStore.getState() });
    expect(saved.focus.returnRows?.['files.open']).toBeUndefined();
  });

  it('shows the diff, not the reader, for a saved file that has changes', () => {
    useAppStore.getState().navigate({
      to: branchPlace({ sessionId: SESSION_ID, mountPath: NOTIFY, tab: 'files' }),
    });
    const { result } = readingOn({ worktreePath: NOTIFY });
    act(() => result.current.selectMode('all'));
    act(() => result.current.pickUnchanged({ ...ENTRY, name: 'relay.ts', relPath: CHANGED.path }));

    expect(result.current.openFile).toBeNull();
  });
});
