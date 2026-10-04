// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  SessionExternalTask,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { TaskBranchPicker } from './TaskBranchPicker';

const workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const project = aProject({
  id: 'p-ledger' as ProjectId,
  workspaceId: workspace.id,
  name: 'ledger-core',
  kind: 'repo',
});
const session = aSession({
  id: 's-ledger' as SessionId,
  workspaceId: workspace.id,
  goal: 'Fix duplicate credit',
});

const mount = ({
  mountId,
  branch,
}: {
  readonly mountId: string;
  readonly branch: string;
}): SessionProjectMount => ({
  mountId: mountId as MountId,
  sessionId: session.id,
  projectId: project.id,
  mountName: 'ledger-core',
  worktreePath: `/tmp/${mountId}`,
  lastWorktreePath: null,
  repoRoot: '/repo/ledger-core',
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const TASK: SessionExternalTask = {
  sessionId: session.id,
  provider: 'linear',
  externalId: 'lin-412',
  identifier: 'HBL-412',
  title: 'Duplicate credit on webhook redelivery',
  url: 'https://linear.app/harborline/issue/HBL-412',
  createdAt: '2026-10-02T09:00:00.000Z' as IsoDateTime,
  scope: 'session',
  projectId: project.id,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [workspace],
    projects: [project],
    sessions: [session],
    sessionExternalTasks: {},
    sessionProjectMounts: {
      [session.id]: [
        mount({ mountId: 'm-export', branch: 'hl/ledger-export' }),
        mount({ mountId: 'm-retry', branch: 'hl/ledger-retry' }),
      ],
    },
  });
  await useAppStore.getState().linkSessionExternalTask(session.id, TASK);
});

afterEach(cleanup);

const linksOf = () =>
  (useAppStore.getState().sessionExternalTasks[session.id] ?? []).map(
    (task) => `${task.identifier}:${task.scope === 'branch' ? task.branch : 'session'}`,
  );

const renderPicker = () => {
  const onClose = vi.fn();
  render(
    <TaskBranchPicker
      sessionId={session.id}
      task={TASK}
      onWorktree={() => undefined}
      onClose={onClose}
    />,
  );
  return { onClose };
};

describe('TaskBranchPicker', () => {
  it('lists every branch of the session and the new worktree row', () => {
    renderPicker();

    expect(screen.getByText('hl/ledger-export')).toBeDefined();
    expect(screen.getByText('hl/ledger-retry')).toBeDefined();
    expect(screen.getByText('New worktree for HBL-412')).toBeDefined();
    expect(screen.getByText('Not on a branch yet')).toBeDefined();
  });

  it('moves the task from the session onto the picked branch', async () => {
    renderPicker();

    await act(async () => {
      fireEvent.click(screen.getByText('hl/ledger-export'));
    });

    expect(linksOf()).toEqual(['HBL-412:hl/ledger-export']);
  });

  it('keeps the task on both branches when it is put on a second one', async () => {
    renderPicker();
    await act(async () => {
      fireEvent.click(screen.getByText('hl/ledger-export'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('hl/ledger-retry'));
    });

    expect(linksOf()).toEqual(['HBL-412:hl/ledger-export', 'HBL-412:hl/ledger-retry']);
  });

  it('opens the worktree form from the new worktree row', () => {
    const onWorktree = vi.fn();
    render(
      <TaskBranchPicker
        sessionId={session.id}
        task={TASK}
        onWorktree={onWorktree}
        onClose={() => undefined}
      />,
    );

    fireEvent.click(screen.getByText('New worktree for HBL-412'));

    expect(onWorktree).toHaveBeenCalledTimes(1);
  });
});
