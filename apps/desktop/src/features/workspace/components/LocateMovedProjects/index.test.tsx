// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    updateProjectIdentity: vi.fn(async () => undefined),
  }),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryProject,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { harborline, ledgerCore } from '../../testing/sessionColumn';
import { LocateMovedProjects } from './index';

const WORKSPACE_ID = harborline.id;
const PROJECT_ID = ledgerCore.id;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    project_relocate: async () => ({
      relocationId: 'r-1',
      repairedGitLinks: true,
      repairError: null,
      restoredSessionFolders: 2,
    }),
  });
  act(() => {
    useAppStore.setState({
      projects: [
        buildStoryProject({
          id: PROJECT_ID,
          workspaceId: WORKSPACE_ID,
          name: 'ledger-core',
          rootPath: '/old/ledger-core',
        }),
      ],
      projectRelocationWorkspaceId: WORKSPACE_ID,
      projectRelocationPhase: 'preview',
      projectRelocationError: null,
      projectRelocationCompleted: [],
      projectRelocationCandidates: [
        {
          projectId: PROJECT_ID,
          name: 'ledger-core',
          fromRoot: '/old/ledger-core',
          toRoot: '/code/ledger-core',
          verdict: 'same_repository',
          identity: { rootCommits: ['abc123'], remoteUrl: null },
          isSelected: true,
          status: 'ready',
        },
      ],
    });
  });
});

afterEach(cleanup);

describe('LocateMovedProjects', () => {
  it('ends with cancel, the alternative and the primary inline', () => {
    render(<LocateMovedProjects workspaceId={WORKSPACE_ID} onChoose={vi.fn()} />);

    const move = screen.getByRole('button', { name: 'Move 1 folder' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(move.closest('[data-slot="form-actions"]')).not.toBeNull();
    expect(cancel.parentElement).toBe(move.parentElement);
    expect(move.parentElement?.lastElementChild).toBe(move);
    expect(screen.getAllByRole('button', { name: 'Choose another folder' })).toHaveLength(1);
  });

  it('moves the folder in the store and offers the undo once it is done', async () => {
    render(<LocateMovedProjects workspaceId={WORKSPACE_ID} onChoose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Move 1 folder' }));

    await screen.findByText('Moved 1 folder. 2 session folders are back.');
    expect(useAppStore.getState().projects[0]?.rootPath).toBe('/code/ledger-core');
    expect(screen.getAllByRole('button', { name: 'Undo move' })).toHaveLength(1);
  });

  it('says what could not be carried over instead of a bare failure count', async () => {
    stubStoryInvoke({
      project_relocate: async () => ({
        relocationId: 'r-3',
        repairedGitLinks: false,
        repairError: 'saved versions: saved versions already exist for the destination folder',
        restoredSessionFolders: 1,
      }),
    });
    render(<LocateMovedProjects workspaceId={WORKSPACE_ID} onChoose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Move 1 folder' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Details' }));

    await screen.findByText(
      /Git links or saved versions could not be carried over for 1 folder\. saved versions: saved versions already exist/,
    );
  });

  it('keeps the old path and shows the error when the move fails, then moves on retry', async () => {
    stubStoryInvoke({
      project_relocate: async () => {
        throw new Error('Target folder is not writable');
      },
    });
    render(<LocateMovedProjects workspaceId={WORKSPACE_ID} onChoose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Move 1 folder' }));

    await screen.findByRole('alert');
    expect(useAppStore.getState().projects[0]?.rootPath).toBe('/old/ledger-core');

    stubStoryInvoke({
      project_relocate: async () => ({
        relocationId: 'r-2',
        repairedGitLinks: true,
        restoredSessionFolders: 0,
      }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Move 1 folder' }));

    await screen.findByText('Moved 1 folder. 0 session folders are back.');
    expect(useAppStore.getState().projects[0]?.rootPath).toBe('/code/ledger-core');
  });

  it('hands over to the folder picker', () => {
    const onChoose = vi.fn();
    render(<LocateMovedProjects workspaceId={WORKSPACE_ID} onChoose={onChoose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Choose another folder' }));

    expect(onChoose).toHaveBeenCalledOnce();
  });

  it('clears the review without moving anything on cancel', () => {
    render(<LocateMovedProjects workspaceId={WORKSPACE_ID} onChoose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(useAppStore.getState().projectRelocationPhase).toBe('idle');
    expect(useAppStore.getState().projects[0]?.rootPath).toBe('/old/ledger-core');
  });
});
