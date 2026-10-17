import { useEffect } from 'react';
import {
  brandId,
  type IsoDateTime,
  type Project,
  type ProjectId,
  type Workspace,
  type WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { BoardShellScene } from '../BoardShellScene';

const CLICK_DELAY_MS = 300;
const HOUR = 3_600_000;
const DAY = 86_400_000;

type OtherSeed = {
  readonly id: string;
  readonly name: string;
  readonly agoMs: number;
  readonly repos: ReadonlyArray<string>;
};

const OTHERS: ReadonlyArray<OtherSeed> = [
  { id: 'northwind', name: 'Northwind', agoMs: 2 * HOUR, repos: ['northwind-sync', 'ledger-core'] },
  { id: 'acme', name: 'Acme', agoMs: 3 * DAY, repos: ['acme-billing'] },
];

type AgoParams = {
  readonly agoMs: number;
};

const isoAgo = ({ agoMs }: AgoParams): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(Date.now() - agoMs).toISOString() });

type CloneParams = {
  readonly base: Workspace;
  readonly id: string;
  readonly name: string;
  readonly agoMs: number;
};

const workspaceOf = ({ base, id, name, agoMs }: CloneParams): Workspace => ({
  ...base,
  id: brandId<WorkspaceId>({ value: `mock-r4-workspace-${id}` }),
  name,
  slug: id,
  lastAccessedAt: isoAgo({ agoMs }),
});

type ReposParams = {
  readonly base: Project;
  readonly workspace: Workspace;
  readonly repos: ReadonlyArray<string>;
};

const reposOf = ({ base, workspace, repos }: ReposParams): ReadonlyArray<Project> =>
  repos.map((name) => ({
    ...base,
    id: brandId<ProjectId>({ value: `${workspace.id}-${name}` }),
    workspaceId: workspace.id,
    name,
    rootPath: `~/code/${workspace.slug}/${name}`,
  }));

const seedOthers = (): void => {
  const state = useAppStore.getState();
  const base = state.workspaces[0];
  const project = state.projects[0];
  if (base === undefined || project === undefined) {
    return;
  }
  const others = OTHERS.map((seed) => ({ seed, workspace: workspaceOf({ base, ...seed }) }));
  const cascadia: Workspace = {
    ...workspaceOf({ base, id: 'cascadia', name: 'Cascadia', agoMs: 9 * DAY }),
    disconnectedAt: isoAgo({ agoMs: 4 * DAY }),
  };
  useAppStore.setState({
    workspaces: [base, ...others.map(({ workspace }) => workspace)],
    disconnectedWorkspaces: [cascadia],
    loadDisconnectedWorkspaces: async () => undefined,
    projects: [
      ...state.projects,
      ...others.flatMap(({ seed, workspace }) =>
        reposOf({ base: project, workspace, repos: seed.repos }),
      ),
    ],
  });
};

export const R4SwitcherScene = () => {
  useEffect(() => {
    seedOthers();
    const timer = window.setInterval(() => {
      const trigger = document.querySelector<HTMLButtonElement>(
        'button[aria-label^="Switch workspace"]',
      );
      if (trigger === null) {
        return;
      }
      trigger.click();
      window.clearInterval(timer);
    }, CLICK_DELAY_MS);
    return () => window.clearInterval(timer);
  }, []);

  return <BoardShellScene />;
};
