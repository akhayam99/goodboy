// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  projects: [] as ReadonlyArray<{
    id: string;
    workspaceId: string;
    rootPath: string;
    kind: 'repo' | 'folder';
  }>,
  integrations: {} as Record<string, ReadonlyArray<{ provider: string; config?: unknown }>>,
  remoteUrl: null as string | null,
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T>(
    selector: (state: {
      projects: typeof h.projects;
      workspaceIntegrations: typeof h.integrations;
    }) => T,
  ) => selector({ projects: h.projects, workspaceIntegrations: h.integrations }),
}));

vi.mock('../../../worktree/worktree', () => ({
  worktreeRemoteUrl: () => Promise.resolve(h.remoteUrl),
}));

import { useWorkspaceBitbucketRepo } from '.';

const bitbucketIntegration = {
  provider: 'bitbucket',
  config: { workspaceSlug: 'acme', email: 'dev@acme.test' },
};

const settle = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  h.projects = [];
  h.integrations = {};
  h.remoteUrl = null;
});

describe('useWorkspaceBitbucketRepo', () => {
  it('resolves the repo slug from the workspace remote', async () => {
    h.projects = [
      {
        id: 'project-1',
        workspaceId: 'workspace-1',
        rootPath: '/repos/goodboy',
        kind: 'repo',
      },
    ];
    h.integrations = { 'workspace-1': [bitbucketIntegration] };
    h.remoteUrl = 'git@bitbucket.org:acme/goodboy.git';

    const { result } = renderHook(() =>
      useWorkspaceBitbucketRepo({ workspaceId: 'workspace-1' as WorkspaceId, isEnabled: true }),
    );

    await waitFor(() => {
      expect(result.current).toEqual({
        workspaceId: 'workspace-1',
        workspaceSlug: 'acme',
        repoSlug: 'goodboy',
        email: 'dev@acme.test',
      });
    });
  });

  it('uses the first repository project in a multi-project workspace', async () => {
    h.projects = [
      {
        id: 'project-2',
        workspaceId: 'workspace-2',
        rootPath: '/repos/container',
        kind: 'repo',
      },
    ];
    h.integrations = { 'workspace-2': [bitbucketIntegration] };
    h.remoteUrl = 'git@bitbucket.org:acme/container.git';

    const { result } = renderHook(() =>
      useWorkspaceBitbucketRepo({ workspaceId: 'workspace-2' as WorkspaceId, isEnabled: true }),
    );
    await settle();

    expect(result.current?.repoSlug).toBe('container');
  });

  it('resolves nothing while the integration is missing', async () => {
    h.projects = [
      {
        id: 'project-3',
        workspaceId: 'workspace-3',
        rootPath: '/repos/other',
        kind: 'repo',
      },
    ];
    h.remoteUrl = 'git@bitbucket.org:acme/other.git';

    const { result } = renderHook(() =>
      useWorkspaceBitbucketRepo({ workspaceId: 'workspace-3' as WorkspaceId, isEnabled: false }),
    );
    await settle();

    expect(result.current).toBeNull();
  });
});
