// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Project, ProjectId, WorkspaceGitStatus, WorkspaceGitState } from '@goodboy/types';

const h = vi.hoisted(() => ({
  invoke: vi.fn(async () => undefined),
  fastForward: vi.fn(async () => undefined),
  store: {
    projectCheckoutPulling: {} as Record<string, boolean>,
    fastForwardProjectCheckout: vi.fn(async () => undefined),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: h.invoke }));
vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof h.store) => T) => selector(h.store),
}));

import { ProjectGitPill } from './ProjectGitPill';

const project = {
  id: 'project-1' as ProjectId,
  name: 'Web',
  rootPath: '/repo/web',
  kind: 'repo',
} as Project;

const statusOf = ({
  state = 'ready',
  behind = 0,
  changed = 0,
  unmerged = 0,
}: {
  readonly state?: WorkspaceGitState;
  readonly behind?: number;
  readonly changed?: number;
  readonly unmerged?: number;
}): WorkspaceGitStatus => ({
  state,
  branch: state === 'ready' ? 'main' : null,
  headSubject: state === 'ready' ? 'base' : null,
  upstreamDistance: { kind: 'known', ahead: 0, behind },
  workingTree: { kind: 'known', staged: 0, unstaged: changed, untracked: 0, unmerged, changed },
  upstream: state === 'ready' ? 'origin/main' : null,
  inProgress: null,
});

const renderPill = ({ status }: { readonly status: WorkspaceGitStatus }) =>
  render(<ProjectGitPill project={project} status={status} shouldShowProjectName={false} />);

beforeEach(() => {
  h.invoke.mockReset();
  h.invoke.mockResolvedValue(undefined);
  h.store.fastForwardProjectCheckout = h.fastForward;
  h.fastForward.mockReset();
  h.fastForward.mockResolvedValue(undefined);
  h.store.projectCheckoutPulling = {};
});

afterEach(cleanup);

describe('ProjectGitPill', () => {
  it('shows the total actionable count when behind and dirty', () => {
    renderPill({ status: statusOf({ behind: 2, changed: 3, unmerged: 1 }) });
    expect(screen.getByTestId('project-git-count').textContent).toBe('6');
  });

  it('shows no badge when the checkout is clean', () => {
    renderPill({ status: statusOf({}) });
    expect(screen.queryByTestId('project-git-count')).toBeNull();
    expect(screen.queryByTestId('project-git-warning')).toBeNull();
  });

  it('shows a warning and opens the init guide for an absent repository', () => {
    renderPill({ status: statusOf({ state: 'absent' }) });
    expect(screen.getByTestId('project-git-warning')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Web git status/ }));
    expect(screen.getByText('This folder has no git repository yet')).toBeDefined();
    expect(screen.getByLabelText('copy command: Create the repository')).toBeDefined();
  });

  it('fast-forwards the correct project and exposes the disabled reason', () => {
    renderPill({ status: statusOf({ behind: 2 }) });
    fireEvent.click(screen.getByRole('button', { name: /Web git status/ }));
    fireEvent.click(screen.getByRole('button', { name: /Fast-forward main to origin\/main/ }));
    expect(h.fastForward).toHaveBeenCalledWith({ projectId: project.id });

    cleanup();
    renderPill({ status: statusOf({}) });
    fireEvent.click(screen.getByRole('button', { name: /Web git status/ }));
    expect(
      screen
        .getByRole('button', { name: /Fast-forward main to origin\/main/ })
        .getAttribute('title'),
    ).toBe('already up to date');
  });

  it('renders an editor launch error as an alert', async () => {
    h.invoke.mockRejectedValueOnce(new Error('editor unavailable'));
    renderPill({ status: statusOf({}) });
    fireEvent.click(screen.getByRole('button', { name: /Web git status/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Open in editor' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('editor unavailable'),
    );
  });
});
