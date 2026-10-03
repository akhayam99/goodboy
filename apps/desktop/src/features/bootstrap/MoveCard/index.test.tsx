// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { aProject, aSession } from '@goodboy/types/testing';
import type { ProjectId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { BootstrapMoveReport } from '../../../store/slices/bootstrap/state';
import type { MoveToBootstrapResult } from '../../../store/slices/bootstrap/moveToBootstrap';
import { MoveCard } from './index';

const project = aProject({ name: 'cascadia', kind: 'repo' });
const bootstrapSession = aSession({ goal: 'bootstrap' });

const REPORT: BootstrapMoveReport = {
  projectId: project.id,
  bootstrapSessionId: bootstrapSession.id,
  movedCount: 12,
  kept: [],
  largeFiles: [],
  ignoredAtRisk: [],
  aligned: null,
};

let useAppStore: StoryStore;
let moves: ProjectId[];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const answerMoveWith = (result: MoveToBootstrapResult) => {
  useAppStore.setState({
    moveToBootstrap: async ({ projectId }) => {
      moves.push(projectId);
      return result;
    },
  });
};

beforeEach(async () => {
  await resetStoryStore();
  moves = [];
  useAppStore.setState({ projects: [project], sessions: [bootstrapSession] });
  answerMoveWith({ kind: 'moved', session: bootstrapSession, report: REPORT });
});

afterEach(cleanup);

describe('MoveCard', () => {
  it('says how many files move and moves them with one click, then opens bootstrap', async () => {
    render(<MoveCard project={project} changedCount={12} isTurnRunning={false} />);

    screen.getByText(
      '12 changed files in the project folder move into a worktree session. The folder ends clean on main.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Move my work' }));

    await waitFor(() => expect(useAppStore.getState().currentSessionId).toBe(bootstrapSession.id));
    expect(moves).toEqual([project.id]);
  });

  it('uses the singular for one file', () => {
    render(<MoveCard project={project} changedCount={1} isTurnRunning={false} />);

    screen.getByText(/1 changed file in the project folder/);
  });

  it('waits for a running turn instead of moving files under it', () => {
    render(<MoveCard project={project} changedCount={3} isTurnRunning />);

    expect(screen.getByRole('button', { name: 'Move my work' })).toHaveProperty('disabled', true);
    screen.getByText('Wait for the running turn to finish');
  });

  it('shows the reason when the move is refused and stays on the first lap', async () => {
    answerMoveWith({
      kind: 'refused',
      reason: 'refused',
      message: 'these folders hold their own git repository: vendor/engine',
    });
    render(<MoveCard project={project} changedCount={3} isTurnRunning={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Move my work' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'these folders hold their own git repository: vendor/engine',
    );
    expect(useAppStore.getState().currentSessionId).toBeNull();
  });

  it('offers Finish instead of a move when the folder has no changed files', () => {
    render(<MoveCard project={project} changedCount={0} isTurnRunning={false} />);

    expect(screen.queryByRole('button', { name: 'Move my work' })).toBeNull();
    screen.getByRole('button', { name: 'Finish' });
    screen.getByText('The project folder has no changed files. Finish to start worktree sessions.');
  });
});
