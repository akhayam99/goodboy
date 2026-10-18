import { brandId } from '@goodboy/types';
import type {
  IsoDateTime,
  MountId,
  OverrideSettings,
  Project,
  ProjectId,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-17T09:00:00.000Z' });

const T0: IsoDateTime = clock.iso({ at: '2026-10-10T09:00:00.000Z' });

const OVERRIDES: OverrideSettings = {
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
};

type CardProject = {
  readonly name: string;
  readonly kind: 'repo' | 'folder';
  readonly branches: ReadonlyArray<string>;
};

const CARD: ReadonlyArray<CardProject> = [
  {
    name: 'payments-api',
    kind: 'repo',
    branches: ['harborline/webhook-retries', 'harborline/idempotency-keys'],
  },
  { name: 'ledger-core', kind: 'repo', branches: ['harborline/ledger-backfill'] },
  { name: 'acme-runbooks', kind: 'folder', branches: [''] },
];

const SPARE: ReadonlyArray<string> = ['notify-relay', 'cascadia-web'];

type NameParams = {
  readonly name: string;
};

const projectIdOf = ({ name }: NameParams): ProjectId =>
  brandId<ProjectId>({ value: `mock-u26-project-${name}` });

type ProjectParams = {
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly kind: 'repo' | 'folder';
};

const projectOf = ({ workspaceId, name, kind }: ProjectParams): Project => ({
  id: projectIdOf({ name }),
  workspaceId,
  name,
  rootPath: `/mock/harborline/${name}`,
  kind,
  baseBranch: kind === 'repo' ? 'main' : null,
  overrides: OVERRIDES,
  createdAt: T0,
  updatedAt: T0,
});

type MountParams = {
  readonly sessionId: SessionId;
  readonly project: CardProject;
  readonly branch: string;
  readonly index: number;
};

const mountOf = ({ sessionId, project, branch, index }: MountParams): SessionProjectMount => ({
  mountId: brandId<MountId>({ value: `mock-u26-mount-${project.name}-${index}` }),
  sessionId,
  projectId: projectIdOf({ name: project.name }),
  mountName: project.name,
  worktreePath:
    project.kind === 'folder'
      ? `/mock/harborline/${project.name}`
      : `/mock/harborline/${project.name}/worktrees/${index}`,
  lastWorktreePath: null,
  repoRoot: `/mock/harborline/${project.name}`,
  branch,
  baseBranch: project.kind === 'repo' ? 'main' : null,
  parallelIndex: index,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

type SeedParams = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
};

export const seedProjectsCard = ({ sessionId, workspaceId }: SeedParams): void => {
  const projects = [
    ...CARD.map((project) => projectOf({ workspaceId, name: project.name, kind: project.kind })),
    ...SPARE.map((name) => projectOf({ workspaceId, name, kind: 'repo' })),
  ];
  const mounts = CARD.flatMap((project) =>
    project.branches.map((branch, index) => mountOf({ sessionId, project, branch, index })),
  );
  useAppStore.setState((state) => ({
    projects: [
      ...state.projects.filter((project) => project.workspaceId !== workspaceId),
      ...projects,
    ],
    sessionProjectMounts: { ...state.sessionProjectMounts, [sessionId]: mounts },
    sessionBranches: { ...state.sessionBranches, [sessionId]: mounts[0]?.branch ?? '' },
    mountGithub: {},
  }));
};
