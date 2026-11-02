// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId, type ProjectId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryProject,
  buildStoryWorkspace,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { StartBranchNotice } from '.';

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const PROJECT_ID = brandId<ProjectId>({ value: 'project-ledger-core' });
const HELD_AT = '/repos/ledger-core/.goodboy/worktrees/gb-held';

let useAppStore: StoryStore;

type WorldParams = {
  readonly goal: string;
  readonly heldAt: string | null;
};

const seedWorld = ({ goal, heldAt }: WorldParams) => {
  storySpies.tauriInvoke.mockImplementation(async (command) => {
    if (command === 'worktree_list_branch_names') {
      return ['main', 'ak/ledger-export', 'ak/notify-retries'];
    }
    if (command === 'worktree_branch_holder') {
      return heldAt;
    }
    return null;
  });
  useAppStore.setState({
    workspaces: [buildStoryWorkspace({ id: WORKSPACE_ID })],
    projects: [
      buildStoryProject({
        id: PROJECT_ID,
        workspaceId: WORKSPACE_ID,
        kind: 'repo',
        rootPath: '/repos/ledger-core',
        baseBranch: 'main',
      }),
    ],
  });
  useAppStore.getState().patchSessionDraft({
    workspaceId: WORKSPACE_ID,
    patch: { workflowGoal: goal, projectIds: [PROJECT_ID] },
  });
};

const draftChoice = () => useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.branchChoice ?? null;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('StartBranchNotice', () => {
  it('says nothing when the goal names no branch', async () => {
    seedWorld({ goal: 'speed up the export', heldAt: null });

    render(<StartBranchNotice workspaceId={WORKSPACE_ID} isDisabled={false} />);

    await waitFor(() => expect(storySpies.tauriInvoke).toHaveBeenCalled());
    expect(screen.queryByText(/Uses the existing branch/)).toBeNull();
  });

  it('shows the existing branch the goal names, as the mount card does', async () => {
    seedWorld({ goal: 'continue on ak/ledger-export', heldAt: null });

    render(<StartBranchNotice workspaceId={WORKSPACE_ID} isDisabled={false} />);

    await screen.findByText(/Uses the existing branch ak\/ledger-export, named in the goal\./);
    expect(screen.queryByRole('button', { name: 'Open the existing worktree' })).toBeNull();
  });

  it('offers a picker for several branches and stores the pick on the draft', async () => {
    seedWorld({ goal: 'compare ak/ledger-export with ak/notify-retries', heldAt: null });

    render(<StartBranchNotice workspaceId={WORKSPACE_ID} isDisabled={false} />);

    await screen.findByText('The goal names 2 branches');
    fireEvent.click(screen.getByRole('button', { name: 'ak/notify-retries' }));

    expect(draftChoice()).toMatchObject({
      projectId: PROJECT_ID,
      pick: { kind: 'branch', branch: 'ak/notify-retries' },
    });
  });

  it('offers to open the worktree that holds the branch and stores that choice', async () => {
    seedWorld({ goal: 'continue on ak/ledger-export', heldAt: HELD_AT });

    render(<StartBranchNotice workspaceId={WORKSPACE_ID} isDisabled={false} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open the existing worktree' }));

    expect(draftChoice()).toMatchObject({
      pick: { kind: 'worktree', branch: 'ak/ledger-export', worktreePath: HELD_AT },
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Open the existing worktree' })).toBeNull(),
    );
  });

  it('stores a new branch choice instead and drops the notice', async () => {
    seedWorld({ goal: 'continue on ak/ledger-export', heldAt: HELD_AT });

    render(<StartBranchNotice workspaceId={WORKSPACE_ID} isDisabled={false} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Start on a new branch' }));

    expect(draftChoice()).toMatchObject({ pick: { kind: 'new-branch' } });
    await waitFor(() => expect(screen.queryByText(/Uses the existing branch/)).toBeNull());
  });

  it('says so when the branches could not be read', async () => {
    seedWorld({ goal: 'continue on ak/ledger-export', heldAt: null });
    storySpies.tauriInvoke.mockImplementation(async () => {
      throw new Error('repository unavailable');
    });

    render(<StartBranchNotice workspaceId={WORKSPACE_ID} isDisabled={false} />);

    await screen.findByText(/Couldn't read the existing branches/);
  });

  it('forgets a choice when the goal changes', async () => {
    seedWorld({ goal: 'continue on ak/ledger-export', heldAt: HELD_AT });
    render(<StartBranchNotice workspaceId={WORKSPACE_ID} isDisabled={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start on a new branch' }));

    useAppStore.getState().patchSessionDraft({
      workspaceId: WORKSPACE_ID,
      patch: { workflowGoal: 'continue on ak/notify-retries' },
    });

    await waitFor(() => expect(draftChoice()).toBeNull());
  });
});
