// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    projects: [] as ReadonlyArray<{ id: string; workspaceId: string; name: string }>,
    sessionProjectMounts: {} as Record<
      string,
      ReadonlyArray<{ projectId: string; mountName: string; branch: string; worktreePath: string }>
    >,
    sessionProjectPrs: {},
  },
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
  useMountDiffStats: () => new Map(),
}));
vi.mock('./ProjectMountRow', () => ({
  ProjectMountRow: ({ mount }: { readonly mount: { readonly mountName: string } }) => (
    <div data-testid="project-mount-row">{mount.mountName}</div>
  ),
}));
vi.mock('./MountProjectAction', () => ({
  MountProjectAction: () => <button>Mount project</button>,
}));

import { ProjectMountRows } from '.';

const session = { id: 'session-1', workspaceId: 'workspace-1' } as Session;

describe('ProjectMountRows', () => {
  beforeEach(() => {
    store.projects = [];
    store.sessionProjectMounts = {};
  });

  it('renders one row per mount in mount order', () => {
    store.sessionProjectMounts = {
      'session-1': [
        { projectId: 'api', mountName: 'API', branch: 'feat/api', worktreePath: '/api' },
        { projectId: 'web', mountName: 'Web', branch: 'feat/web', worktreePath: '/web' },
      ],
    };
    render(<ProjectMountRows session={session} onSelectLens={vi.fn()} />);

    expect(screen.getAllByTestId('project-mount-row').map((row) => row.textContent)).toEqual([
      'API',
      'Web',
    ]);
  });

  it('renders a quiet mount action when no project is mounted', () => {
    render(<ProjectMountRows session={session} onSelectLens={vi.fn()} />);

    expect(screen.getByText('No project mounted yet')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Mount project' })).toBeDefined();
  });
});
