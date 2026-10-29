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

import type { ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { brandId, type DiffView, type SessionId } from '@goodboy/types';
import { STORE_IMPORT_TIMEOUT_MS, importStore } from '../../../../store/storyHarness';
import type { SessionDiff } from '../../../diff/hooks/useSessionDiff';
import { BranchDiffContext } from '../../branchDiffContext';
import { useOpenBranchFolder } from '.';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });

type DiffParams = {
  readonly view: DiffView;
};

const diffOf = ({ view }: DiffParams): SessionDiff => ({
  files: [],
  patch: '',
  loading: false,
  isRefreshing: false,
  error: null,
  view,
  setView: vi.fn(),
  alternate: null,
  commits: [],
  status: null,
  metaError: null,
  refresh: vi.fn(),
  viewed: { stateOf: () => 'none', onToggle: vi.fn() },
  focusPath: 'src/ledger/ledger.ts',
  focusThreadId: null,
  clearFocus: vi.fn(),
});

type OpenParams = {
  readonly diff: SessionDiff | null;
};

const open = ({ diff }: OpenParams) => {
  const onSelectTab = vi.fn();
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <BranchDiffContext.Provider value={diff}>{children}</BranchDiffContext.Provider>
  );
  const { result } = renderHook(() => useOpenBranchFolder({ sessionId: SESSION, onSelectTab }), {
    wrapper,
  });
  return { openFolder: result.current, onSelectTab };
};

let store: Awaited<ReturnType<typeof importStore>>;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(() => {
  store.setState({ branchFilesFolder: {}, diffFocus: {} });
});

describe('useOpenBranchFolder', () => {
  it('returns Files to the branch diff and drops the commit it had focused', () => {
    const diff = diffOf({ view: { kind: 'commit', sha: 'a1b2c3d' } });
    store.setState({ diffFocus: { [SESSION]: { kind: 'commit', sha: 'a1b2c3d', path: 'a.ts' } } });
    const { openFolder, onSelectTab } = open({ diff });

    act(() => openFolder('src'));

    expect(diff.setView).toHaveBeenCalledWith({ kind: 'branch' });
    expect(diff.clearFocus).toHaveBeenCalledTimes(1);
    expect(store.getState().diffFocus[SESSION]).toBeNull();
    expect(store.getState().branchFilesFolder[SESSION]).toBe('src');
    expect(onSelectTab).toHaveBeenCalledWith('files');
  });

  it('leaves the working tree view for the branch diff', () => {
    const diff = diffOf({ view: { kind: 'working', scope: 'all' } });
    const { openFolder } = open({ diff });

    act(() => openFolder('docs'));

    expect(diff.setView).toHaveBeenCalledWith({ kind: 'branch' });
  });

  it('keeps the branch view it already shows without reloading it', () => {
    const diff = diffOf({ view: { kind: 'branch' } });
    const { openFolder } = open({ diff });

    act(() => openFolder('docs'));

    expect(diff.setView).not.toHaveBeenCalled();
    expect(store.getState().branchFilesFolder[SESSION]).toBe('docs');
  });

  it('still opens the folder when no branch diff is shared', () => {
    const { openFolder, onSelectTab } = open({ diff: null });

    act(() => openFolder('docs'));

    expect(store.getState().branchFilesFolder[SESSION]).toBe('docs');
    expect(onSelectTab).toHaveBeenCalledWith('files');
  });
});
