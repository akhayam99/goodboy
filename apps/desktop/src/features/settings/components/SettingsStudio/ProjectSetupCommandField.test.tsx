// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Project, ProjectId, ProjectSetupCommand, WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    updateProjectSetup: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { ProjectSetupCommandField } from './ProjectSetupCommandField';

const UPDATED_AT = '2026-09-23T00:00:00.000Z' as ProjectSetupCommand['updatedAt'];

const project = (setup?: ProjectSetupCommand): Project => ({
  id: 'project-1' as ProjectId,
  workspaceId: 'workspace-1' as WorkspaceId,
  name: 'api',
  rootPath: '/repos/api',
  kind: 'repo',
  baseBranch: null,
  overrides: {} as Project['overrides'],
  createdAt: UPDATED_AT,
  updatedAt: UPDATED_AT,
  ...(setup !== undefined && { setup }),
});

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('ProjectSetupCommandField', () => {
  it('starts unset and records an explicit no-op separately', async () => {
    render(<ProjectSetupCommandField project={project()} />);

    expect(screen.getByRole('tab', { name: 'Not set' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Nothing to install' }));

    await waitFor(() =>
      expect(state.updateProjectSetup).toHaveBeenCalledWith({
        projectId: 'project-1',
        setup: { kind: 'none' },
      }),
    );
  });

  it('saves a trimmed command only when it is not empty', async () => {
    render(<ProjectSetupCommandField project={project()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Command' }));
    const input = screen.getByLabelText('Setup command for api');
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save.hasAttribute('disabled')).toBe(true);
    fireEvent.change(input, {
      target: { value: '  CI=1 pnpm install --frozen-lockfile --ignore-scripts  ' },
    });
    fireEvent.click(save);

    await waitFor(() =>
      expect(state.updateProjectSetup).toHaveBeenCalledWith({
        projectId: 'project-1',
        setup: { kind: 'command', command: 'CI=1 pnpm install --frozen-lockfile --ignore-scripts' },
      }),
    );
  });

  it('shows the stored command and its revision', () => {
    render(
      <ProjectSetupCommandField
        project={project({
          kind: 'command',
          command: 'make deps',
          revision: 4,
          updatedAt: UPDATED_AT,
        })}
      />,
    );

    expect((screen.getByLabelText('Setup command for api') as HTMLInputElement).value).toBe(
      'make deps',
    );
    expect(screen.getByText('revision 4')).toBeTruthy();
  });

  it('clears the configuration back to unset', async () => {
    render(
      <ProjectSetupCommandField
        project={project({ kind: 'none', revision: 2, updatedAt: UPDATED_AT })}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Not set' }));

    await waitFor(() =>
      expect(state.updateProjectSetup).toHaveBeenCalledWith({
        projectId: 'project-1',
        setup: { kind: 'unset' },
      }),
    );
  });
});
