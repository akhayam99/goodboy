// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import type { SessionProjectMount, WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../../shared/lib/storage-keys';
import { useAppStore } from '../../store';
import { NO_PROJECT_FILTER_ID, sessionMatchesProjectFilter } from './index';

const WORKSPACE_ID = 'workspace-filter-test' as WorkspaceId;

const mount = {
  projectId: 'project-a',
  mountName: 'project-a',
  worktreePath: '/tmp/project-a',
  repoRoot: '/tmp/project-a',
  branch: 'main',
} as SessionProjectMount;

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ selectedProjectIds: {} });
});

describe('sessionFilters slice', () => {
  it('persists selection per workspace and restores it into the slice', () => {
    useAppStore.getState().setSelectedProjectIds({
      workspaceId: WORKSPACE_ID,
      selectedProjectIds: ['project-a', NO_PROJECT_FILTER_ID],
    });
    useAppStore.setState({ selectedProjectIds: {} });
    const restored = useAppStore.getState().getSelectedProjectIds({ workspaceId: WORKSPACE_ID });
    expect(restored).toEqual(['project-a', NO_PROJECT_FILTER_ID]);
    expect(useAppStore.getState().selectedProjectIds[WORKSPACE_ID]).toEqual(restored);
    expect(
      localStorage.getItem(`${STORAGE_PREFIXES.sessionFilters}${WORKSPACE_ID}`),
    ).not.toBeNull();
  });

  it('shows all sessions for an empty selection', () => {
    expect(sessionMatchesProjectFilter({ mounts: [mount], selectedProjectIds: [] })).toBe(true);
  });

  it('matches any mounted selection and the explicit no-project selection', () => {
    expect(
      sessionMatchesProjectFilter({ mounts: [mount], selectedProjectIds: ['project-a'] }),
    ).toBe(true);
    expect(
      sessionMatchesProjectFilter({ mounts: [mount], selectedProjectIds: ['project-b'] }),
    ).toBe(false);
    expect(
      sessionMatchesProjectFilter({ mounts: [], selectedProjectIds: [NO_PROJECT_FILTER_ID] }),
    ).toBe(true);
  });
});
