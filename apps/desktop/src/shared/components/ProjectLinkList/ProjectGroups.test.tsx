// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime, Project, ProjectId, WorkspaceId } from '@goodboy/types';

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (s: Record<string, unknown>) => T) =>
    selector({
      reportError: vi.fn(async () => undefined),
      setProjectStarred: vi.fn(async () => undefined),
      describeProject: vi.fn(async () => undefined),
    }),
  useWorkspaceHasUnread: () => false,
}));
vi.mock('../../../features/workspace/hooks/useProjectGitStatuses', () => ({
  useProjectGitStatuses: () => [],
}));

import { ProjectGroups } from './ProjectGroups';

const NOW = '2026-08-22T00:00:00.000Z' as IsoDateTime;
const WORKSPACE_ID = 'ws-1' as WorkspaceId;

const overrides = {
  defaultProviderId: null,
  defaultBranchPrefix: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
} as const;

const project = ({
  id,
  name,
  starred = false,
}: {
  readonly id: string;
  readonly name: string;
  readonly starred?: boolean;
}): Project => ({
  id: id as ProjectId,
  workspaceId: WORKSPACE_ID,
  name,
  rootPath: `/repos/${id}`,
  kind: 'folder',
  overrides,
  createdAt: NOW,
  updatedAt: NOW,
  ...(starred ? { starredAt: NOW } : {}),
});

afterEach(cleanup);

describe('ProjectGroups', () => {
  it('freezes grouping while the pointer is inside, then regroups once it leaves', () => {
    const a = project({ id: 'p-a', name: 'admin-console' });
    const b = project({ id: 'p-b', name: 'billing-worker' });
    const onUnlink = vi.fn(async () => undefined);

    const { rerender } = render(
      <ProjectGroups
        workspaceId={WORKSPACE_ID}
        projects={[a, b]}
        busy={false}
        query=""
        onUnlink={onUnlink}
      />,
    );

    expect(screen.queryByText('Starred')).toBeNull();

    fireEvent.mouseEnter(screen.getByTestId('project-groups'));
    rerender(
      <ProjectGroups
        workspaceId={WORKSPACE_ID}
        projects={[{ ...a, starredAt: NOW }, b]}
        busy={false}
        query=""
        onUnlink={onUnlink}
      />,
    );

    expect(screen.queryByText('Starred')).toBeNull();

    fireEvent.mouseLeave(screen.getByTestId('project-groups'));
    expect(screen.getByText('Starred')).toBeDefined();
  });

  it('shows the first 8 of All and reveals the rest on Show more', () => {
    const projects = Array.from({ length: 9 }, (_, index) =>
      project({ id: `p-${index}`, name: `project-${index}` }),
    );

    render(
      <ProjectGroups
        workspaceId={WORKSPACE_ID}
        projects={projects}
        busy={false}
        query=""
        onUnlink={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getAllByRole('img', { name: 'Folder' })).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'Show 1 more' }));
    expect(screen.getAllByRole('img', { name: 'Folder' })).toHaveLength(9);
  });

  it('shows every match while searching, without the Show more pagination', () => {
    const projects = Array.from({ length: 9 }, (_, index) =>
      project({ id: `p-${index}`, name: `project-${index}` }),
    );

    render(
      <ProjectGroups
        workspaceId={WORKSPACE_ID}
        projects={projects}
        busy={false}
        query="project"
        onUnlink={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getAllByRole('img', { name: 'Folder' })).toHaveLength(9);
    expect(screen.queryByRole('button', { name: /show \d+ more/i })).toBeNull();
  });
});
