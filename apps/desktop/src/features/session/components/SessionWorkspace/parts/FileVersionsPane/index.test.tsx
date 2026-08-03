// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { FileVersion, FileVersionId, IsoDateTime, SessionId } from '@goodboy/types';

const SESSION_ID = 'session-1' as SessionId;

const { store } = vi.hoisted(() => ({
  store: {
    sessionFileVersions: {} as Record<SessionId, ReadonlyArray<FileVersion>>,
    sessionFileVersionsLoading: {} as Record<SessionId, boolean>,
    sessionFileVersionSelectedPath: {} as Record<SessionId, string | null>,
    loadSessionFileVersions: vi.fn(async () => undefined),
    selectSessionFileVersionPath: vi.fn(),
    restoreSessionFileVersion: vi.fn(async () => undefined),
    deleteSessionFileVersion: vi.fn(async () => undefined),
    deleteAllSessionFileVersions: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    ScrollFade: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

import { FileVersionsPane } from './index';

const versions = [
  {
    id: 'v-3' as FileVersionId,
    sessionId: SESSION_ID,
    relativePath: 'docs/plan.md',
    storedName: 'v-3.bin',
    sizeBytes: 4,
    contentHash: 'hash-3',
    changeKind: 'modified',
    snapshotSource: 'agent_turn',
    capturedAt: '2026-08-02T03:00:00.000Z' as IsoDateTime,
  },
  {
    id: 'v-2' as FileVersionId,
    sessionId: SESSION_ID,
    relativePath: 'docs/plan.md',
    storedName: 'v-2.bin',
    sizeBytes: 4,
    contentHash: 'hash-2',
    changeKind: 'modified',
    snapshotSource: 'agent_turn',
    capturedAt: '2026-08-02T02:00:00.000Z' as IsoDateTime,
  },
  {
    id: 'v-1' as FileVersionId,
    sessionId: SESSION_ID,
    relativePath: 'notes/todo.md',
    storedName: 'v-1.bin',
    sizeBytes: 4,
    contentHash: 'hash-1',
    changeKind: 'modified',
    snapshotSource: 'agent_turn',
    capturedAt: '2026-08-02T01:00:00.000Z' as IsoDateTime,
  },
] satisfies ReadonlyArray<FileVersion>;

beforeEach(() => {
  store.sessionFileVersions = {
    [SESSION_ID]: versions,
  } as Record<SessionId, ReadonlyArray<FileVersion>>;
  store.sessionFileVersionsLoading = {};
  store.sessionFileVersionSelectedPath = {
    [SESSION_ID]: 'docs/plan.md',
  } as Record<SessionId, string | null>;
  store.loadSessionFileVersions.mockClear();
  store.selectSessionFileVersionPath.mockClear();
  store.restoreSessionFileVersion.mockClear();
  store.deleteSessionFileVersion.mockClear();
  store.deleteAllSessionFileVersions.mockClear();
});

afterEach(cleanup);

describe('FileVersionsPane', () => {
  it('lists file groups and restores the selected version', () => {
    const view = render(
      <FileVersionsPane sessionId={SESSION_ID} sessionDir="/tmp/session-1" onClose={vi.fn()} />,
    );

    expect(store.loadSessionFileVersions).toHaveBeenCalledWith({ sessionId: SESSION_ID });
    expect(screen.getByRole('button', { name: /docs\/plan\.md/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /notes\/todo\.md/ })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /notes\/todo\.md/ }));
    expect(store.selectSessionFileVersionPath).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      relativePath: 'notes/todo.md',
    });

    store.sessionFileVersionSelectedPath[SESSION_ID] = 'notes/todo.md';
    view.rerender(
      <FileVersionsPane sessionId={SESSION_ID} sessionDir="/tmp/session-1" onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'restore this version' }));
    expect(store.restoreSessionFileVersion).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      versionId: 'v-1' as FileVersionId,
      sessionDir: '/tmp/session-1',
    });
  });

  it('closes to the overview from the empty state, keeping the passed-in back action separate', () => {
    store.sessionFileVersions = {} as Record<SessionId, ReadonlyArray<FileVersion>>;
    const onClose = vi.fn();

    render(
      <FileVersionsPane
        sessionId={SESSION_ID}
        sessionDir="/tmp/session-1"
        onClose={onClose}
        actions={<button type="button">Back</button>}
      />,
    );

    expect(screen.getByText('No versions yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
