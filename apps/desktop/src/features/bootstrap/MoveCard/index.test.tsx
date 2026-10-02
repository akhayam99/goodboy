// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { aProject, aSession } from '@goodboy/types/testing';
import { sessionPlace } from '../../../store/slices/navigation/place';

const project = aProject({ name: 'cascadia', kind: 'repo' });
const bootstrapSession = aSession({ goal: 'bootstrap' });

const h = vi.hoisted(() => ({
  store: { moveToBootstrap: vi.fn(), navigate: vi.fn() },
}));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof h.store) => T) => selector(h.store),
}));

import { MoveCard } from './index';

beforeEach(() => {
  h.store.moveToBootstrap.mockReset();
  h.store.moveToBootstrap.mockResolvedValue({
    kind: 'moved',
    session: bootstrapSession,
    report: {},
  });
  h.store.navigate.mockReset();
});

afterEach(cleanup);

describe('MoveCard', () => {
  it('says how many files move and moves them with one click, then opens bootstrap', async () => {
    render(<MoveCard project={project} changedCount={12} isTurnRunning={false} />);

    expect(
      screen.getByText(
        '12 changed files in the project folder move into a worktree session. The folder ends clean on main.',
      ),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Move my work' }));

    await waitFor(() =>
      expect(h.store.navigate).toHaveBeenCalledWith({
        to: sessionPlace({ sessionId: bootstrapSession.id }),
      }),
    );
    expect(h.store.moveToBootstrap).toHaveBeenCalledWith({ projectId: project.id });
  });

  it('uses the singular for one file', () => {
    render(<MoveCard project={project} changedCount={1} isTurnRunning={false} />);

    expect(screen.getByText(/1 changed file in the project folder/)).toBeDefined();
  });

  it('waits for a running turn instead of moving files under it', () => {
    render(<MoveCard project={project} changedCount={3} isTurnRunning />);

    expect(screen.getByRole('button', { name: 'Move my work' })).toHaveProperty('disabled', true);
    expect(screen.getByText('Wait for the running turn to finish')).toBeDefined();
  });

  it('shows the reason when the move is refused and stays on the first lap', async () => {
    h.store.moveToBootstrap.mockResolvedValue({
      kind: 'refused',
      reason: 'refused',
      message: 'these folders hold their own git repository: vendor/engine',
    });
    render(<MoveCard project={project} changedCount={3} isTurnRunning={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Move my work' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'these folders hold their own git repository: vendor/engine',
    );
    expect(h.store.navigate).not.toHaveBeenCalled();
  });

  it('offers no move when the folder has no changed files', () => {
    render(<MoveCard project={project} changedCount={0} isTurnRunning={false} />);

    expect(screen.queryByRole('button', { name: 'Move my work' })).toBeNull();
    expect(
      screen.getByText(
        'The project folder has no changed files. Starting a new session is enough.',
      ),
    ).toBeDefined();
  });
});
