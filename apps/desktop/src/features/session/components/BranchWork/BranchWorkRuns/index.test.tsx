// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { aProject, aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { branchPlace } from '../../../../../store/slices/navigation/place';
import { NOW_SESSION } from '../../../central/now/testing/nowModelOf';
import { branchGroupsOf } from '../../../branchGroupsOf';
import { markBranchWorkReturn } from '../../../markBranchWorkReturn';
import { aMountView } from '../../../testing/aMountView';
import { aSessionRun } from '../../../testing/aSessionRun';
import { BranchWorkRuns } from './index';

const SESSION = aSession({ id: NOW_SESSION });
const PAYMENTS = aProject({ name: 'payments-api' });
const DUP = aMountView({
  key: 'dup',
  sessionId: NOW_SESSION,
  projectId: PAYMENTS.id,
  projectName: 'payments-api',
  branch: 'fix/duplicate-credit',
});
const BRANCH = {
  mountId: DUP.id,
  projectId: PAYMENTS.id,
  projectName: 'payments-api',
  branch: DUP.branch,
  worktreePath: DUP.worktreePath,
};
const RUNS = [
  aSessionRun({ id: 'ledger-core', branches: [BRANCH] }),
  aSessionRun({ id: 'notify-relay', isFinished: true, branches: [BRANCH] }),
  aSessionRun({ id: 'northwind', isFinished: true, isArchived: true, branches: [BRANCH] }),
];
const GROUP = branchGroupsOf({ runs: RUNS, mounts: [] })[0];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ currentWorkspaceId: SESSION.workspaceId, sessions: [SESSION] });
  useAppStore.getState().navigate({
    to: branchPlace({ sessionId: NOW_SESSION, mountPath: DUP.worktreePath, tab: 'work' }),
  });
});

afterEach(cleanup);

const renderRuns = () => {
  if (GROUP === undefined) {
    throw new Error('no group');
  }
  return render(
    <ToastProvider>
      <BranchWorkRuns
        session={SESSION}
        group={GROUP}
        mounts={[]}
        mountPath={DUP.worktreePath}
        label="Runs"
        onLeave={() => markBranchWorkReturn({ groupKey: GROUP.key, mountPath: DUP.worktreePath })}
      />
    </ToastProvider>,
  );
};

describe('BranchWorkRuns', () => {
  it('shows the archived run again on Back after it was opened from the Archived fold', () => {
    renderRuns();
    expect(screen.queryByRole('button', { name: /^Open northwind/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '1 archived' }));

    fireEvent.click(screen.getByRole('button', { name: /^Open northwind/ }));
    cleanup();
    useAppStore.getState().up();
    renderRuns();

    screen.getByRole('button', { name: /^Open northwind/ });
  });

  it('shows the finished run again on Back after it was opened from the Finished fold', () => {
    renderRuns();
    expect(screen.queryByRole('button', { name: /^Open notify-relay/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '1 finished' }));

    fireEvent.click(screen.getByRole('button', { name: /^Open notify-relay/ }));
    cleanup();
    useAppStore.getState().up();
    renderRuns();

    screen.getByRole('button', { name: /^Open notify-relay/ });
  });

  it('keeps the folds shut on a first visit', () => {
    renderRuns();

    expect(screen.queryByRole('button', { name: /^Open notify-relay/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Open northwind/ })).toBeNull();
  });
});
