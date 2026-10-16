// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { IsoDateTime, Project, ProjectId, WorkspaceId } from '@goodboy/types';

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (s: Record<string, unknown>) => T) =>
    selector({
      settings: {},
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
  afterMerge: null,
  defaultBranchTemplate: null,
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

  it('calls the unstarred group Other projects once a Starred group is shown', () => {
    render(
      <ProjectGroups
        workspaceId={WORKSPACE_ID}
        projects={[
          project({ id: 'p-a', name: 'admin-console', starred: true }),
          project({ id: 'p-b', name: 'billing-worker' }),
        ]}
        busy={false}
        query=""
        onUnlink={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText('Starred')).toBeDefined();
    expect(screen.getByText('Other projects')).toBeDefined();
    expect(screen.queryByText('All projects')).toBeNull();
  });

  it('shows one Projects heading and the star hint when nothing is starred', () => {
    render(
      <ProjectGroups
        workspaceId={WORKSPACE_ID}
        projects={[project({ id: 'p-a', name: 'admin-console' })]}
        busy={false}
        query=""
        onUnlink={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeDefined();
    expect(screen.getByText('Star the ones you use most.')).toBeDefined();
    expect(screen.queryByText('Other projects')).toBeNull();
  });

  it('draws Starred and Other projects as two headed groups with their counts', () => {
    render(
      <ProjectGroups
        workspaceId={WORKSPACE_ID}
        projects={[
          project({ id: 'p-a', name: 'payments-api', starred: true }),
          project({ id: 'p-b', name: 'ledger-core', starred: true }),
          project({ id: 'p-c', name: 'notify-relay' }),
        ]}
        busy={false}
        query=""
        onUnlink={vi.fn(async () => undefined)}
      />,
    );

    const starred = screen.getByRole('region', { name: 'Starred' });
    const others = screen.getByRole('region', { name: 'Other projects' });
    expect(within(starred).getByRole('heading', { name: 'Starred' })).toBeDefined();
    expect(within(starred).getByText('2')).toBeDefined();
    expect(within(starred).getByText('Agents and pickers list these first.')).toBeDefined();
    expect(within(others).getByRole('heading', { name: 'Other projects' })).toBeDefined();
    expect(within(others).getByText('1')).toBeDefined();
    expect(
      within(starred)
        .getAllByRole('button', { name: /^Edit / })
        .map((button) => button.textContent),
    ).toEqual(['ledger-core', 'payments-api']);
  });

  it('reserves the star at rest for starred rows and reveals it on the others', () => {
    render(
      <ProjectGroups
        workspaceId={WORKSPACE_ID}
        projects={[
          project({ id: 'p-a', name: 'payments-api', starred: true }),
          project({ id: 'p-c', name: 'notify-relay' }),
        ]}
        busy={false}
        query=""
        onUnlink={vi.fn(async () => undefined)}
      />,
    );

    const starred = screen.getByRole('button', { name: 'Starred: payments-api' });
    const other = screen.getByRole('button', { name: 'Starred: notify-relay' });
    expect(starred.getAttribute('aria-pressed')).toBe('true');
    expect(other.getAttribute('aria-pressed')).toBe('false');
  });

  it('puts the scripts slot in the open editor card, never on the row', () => {
    render(
      <ProjectGroups
        workspaceId={WORKSPACE_ID}
        projects={[project({ id: 'p-a', name: 'payments-api' })]}
        busy={false}
        query=""
        onUnlink={vi.fn(async () => undefined)}
        editorScripts={({ project: entry }) => <p>Scripts slot of {entry.name}</p>}
      />,
    );

    expect(screen.queryByRole('button', { name: /^Scripts/ })).toBeNull();
    expect(screen.queryByText('Scripts slot of payments-api')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit payments-api' }));

    expect(screen.getByText('Scripts slot of payments-api')).toBeDefined();
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
