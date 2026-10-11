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
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { MountId, Project, Session, SessionProjectMount, Workspace } from '@goodboy/types';
import { TEST_NOW, aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { ProjectFilter } from './ProjectFilter';

let useAppStore: StoryStore;

const HARBORLINE: Workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const NAMES = [
  'ledger-core',
  'notify-relay',
  'payments-api',
  'cascadia-web',
  'northwind-docs',
  'acme-infra',
  'harborline-app',
  'runbooks',
  'orbit-sdk',
];

const projectOf = ({ name, isStarred }: { readonly name: string; readonly isStarred: boolean }) =>
  aProject({
    workspaceId: HARBORLINE.id,
    name,
    rootPath: `/repos/${name}`,
    kind: 'repo',
    ...(isStarred ? { starredAt: TEST_NOW } : {}),
  });

const isMountId = (value: string): value is MountId => value.startsWith('mount-');

const mountIdOf = ({ session }: { readonly session: Session }): MountId => {
  const value = `mount-${session.id}`;
  if (!isMountId(value)) {
    throw new Error(`not a mount id: ${value}`);
  }
  return value;
};

const mountOf = ({
  session,
  project,
}: {
  readonly session: Session;
  readonly project: Project;
}): SessionProjectMount => ({
  mountId: mountIdOf({ session }),
  sessionId: session.id,
  projectId: project.id,
  mountName: project.name,
  worktreePath: `${project.rootPath}/.goodboy/worktrees/${session.id}`,
  lastWorktreePath: null,
  repoRoot: project.rootPath,
  branch: 'goodboy/har-1',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const seed = ({ count, starred }: { readonly count: number; readonly starred: number }) => {
  const projects = NAMES.slice(0, count).map((name, index) =>
    projectOf({ name, isStarred: index < starred }),
  );
  const pairs = projects.map((project) => ({
    project,
    session: aSession({ workspaceId: HARBORLINE.id, goal: `Work on ${project.name}` }),
  }));
  const sessions = pairs.map((pair) => pair.session);
  useAppStore.setState({
    workspaces: [HARBORLINE],
    currentWorkspaceId: HARBORLINE.id,
    projects,
    sessions,
    sessionProjectMounts: Object.fromEntries(
      pairs.map((pair) => [pair.session.id, [mountOf(pair)]]),
    ),
  });
  render(<ProjectFilter workspaceId={HARBORLINE.id} sessions={sessions} />);
  fireEvent.click(screen.getByRole('combobox', { name: 'Project filter' }));
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('ProjectFilter', () => {
  it('lists starred projects first under a Starred heading from six projects', () => {
    seed({ count: 6, starred: 2 });

    const list = screen.getByRole('listbox', { name: 'Project filter' });
    expect(within(list).getByText('Starred')).toBeDefined();
    expect(within(list).getByText('Other projects')).toBeDefined();
    expect(
      within(list)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'ledger-core1',
      'notify-relay1',
      'acme-infra1',
      'cascadia-web1',
      'northwind-docs1',
      'payments-api1',
    ]);
  });

  it('shows no headings with fewer than six projects or nothing starred', () => {
    seed({ count: 5, starred: 2 });

    const list = screen.getByRole('listbox', { name: 'Project filter' });
    expect(within(list).queryByText('Starred')).toBeNull();
    expect(within(list).queryByText('Other projects')).toBeNull();
  });

  it('flattens the groups while searching', () => {
    seed({ count: 9, starred: 2 });
    const list = screen.getByRole('listbox', { name: 'Project filter' });
    expect(within(list).getByText('Starred')).toBeDefined();

    fireEvent.change(screen.getByRole('combobox', { name: 'Search' }), {
      target: { value: 'a' },
    });

    expect(within(list).queryByText('Starred')).toBeNull();
    expect(within(list).queryByText('Other projects')).toBeNull();
  });
});
