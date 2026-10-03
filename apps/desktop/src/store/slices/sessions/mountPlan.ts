import { availableBranchName, slugify } from '@goodboy/core';
import type { MountId, Project, ProjectId, SessionId } from '@goodboy/types';
import { mountDirName } from '../project-mounts/mountDirName';
import { branchNamingSettings } from './branchNamingSettings';
import { branchLeaf } from './branchLeaf';
import { materializationSeedFor } from './materializationSeeds';
import { sessionBranchNaming, type BranchNaming } from './sessionBranchNaming';
import type { AppStore } from '../../store';
import { sessionById } from './sessionIndex';
import { projectById } from '../projects/projectIndex';

export type MountPlanState = Pick<
  AppStore,
  | 'sessions'
  | 'archivedSessions'
  | 'projects'
  | 'workspaceOverrides'
  | 'githubStatus'
  | 'githubWorkspaceStatus'
  | 'sessionWorktreeRecords'
  | 'sessionProjectMounts'
  | 'sessionExternalTasks'
>;

export type MountPlan = {
  readonly project: Project;
  readonly mountId: MountId;
  readonly naming: BranchNaming;
  readonly slug: string;
  readonly branch: string | null;
  readonly adoptedBranch: string | null;
  readonly baseBranch: string | null;
  readonly targetPath: string;
  readonly takenBranches: ReadonlyArray<string>;
};

type Params = {
  readonly state: MountPlanState;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly mountId: MountId;
  readonly taskIdentifiers?: ReadonlyArray<string>;
  readonly repoBranches?: ReadonlyArray<string>;
};

type PathParams = {
  readonly project: Project;
  readonly slug: string;
  readonly mountId: MountId;
  readonly folderName: string | undefined;
};

const targetPathFor = ({ project, slug, mountId, folderName }: PathParams): string => {
  if (project.kind !== 'repo') {
    return `${project.rootPath}/sessions/${folderName ?? slug}`;
  }
  return `${project.rootPath}/.goodboy/worktrees/${mountDirName({ sessionSlug: slug, mountId })}`;
};

export const mountPlan = ({
  state,
  sessionId,
  projectId,
  mountId,
  taskIdentifiers,
  repoBranches = [],
}: Params): MountPlan | null => {
  const session =
    sessionById(state.sessions, sessionId) ??
    Object.values(state.archivedSessions)
      .flat()
      .find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    return null;
  }
  const project = projectById(state.projects, projectId);
  if (project === undefined || project.workspaceId !== session.workspaceId) {
    return null;
  }
  const seed = materializationSeedFor({ sessionId });
  const settings = branchNamingSettings({ state, workspaceId: session.workspaceId, project });
  const liveSessionIds: ReadonlySet<string> = new Set(
    state.sessions
      .filter(
        (candidate) => candidate.workspaceId === session.workspaceId && candidate.id !== sessionId,
      )
      .map((candidate) => candidate.id),
  );
  const recordBranches = Object.entries(state.sessionWorktreeRecords ?? {}).flatMap(
    ([candidateId, records]) =>
      liveSessionIds.has(candidateId) ? records.map((record) => record.branch) : [],
  );
  const mountBranches = Object.entries(state.sessionProjectMounts).flatMap(
    ([candidateId, mounts]) =>
      liveSessionIds.has(candidateId) ? mounts.map((mount) => mount.branch) : [],
  );
  const takenBranches = [...recordBranches, ...mountBranches].filter((branch) => branch !== '');
  const storedIdentifiers = (state.sessionExternalTasks[sessionId] ?? []).map(
    (task) => task.identifier,
  );
  const named = sessionBranchNaming({
    template: settings.template,
    prefix: seed?.branchPrefix ?? settings.prefix,
    user: settings.user,
    goal: session.goal,
    ...(seed?.sessionSlug !== undefined ? { explicitSlug: seed.sessionSlug } : {}),
    taskIdentifiers: storedIdentifiers.length > 0 ? storedIdentifiers : (taskIdentifiers ?? []),
  });
  const fallbackSlug = `session-${sessionId.slice(0, 8)}`;
  const namedSlug = slugify({ input: named.values.slug ?? '', fallback: '' });
  const naming: BranchNaming =
    namedSlug === '' && named.values['task-id'] === undefined
      ? { ...named, values: { ...named.values, slug: fallbackSlug } }
      : named;
  const adoptedBranch = seed?.existingBranch ?? null;
  const branch =
    project.kind === 'repo' && adoptedBranch === null
      ? availableBranchName({ ...naming, taken: [...takenBranches, ...repoBranches] })
      : null;
  const leaf = slugify({ input: branchLeaf({ branch: branch ?? '' }), fallback: '' });
  const slug = leaf !== '' ? leaf : namedSlug !== '' ? namedSlug : fallbackSlug;
  return {
    project,
    mountId,
    naming,
    slug,
    branch,
    adoptedBranch: project.kind === 'repo' ? adoptedBranch : null,
    baseBranch: project.kind === 'repo' ? (project.baseBranch ?? null) : null,
    targetPath: targetPathFor({ project, slug, mountId, folderName: seed?.folderName }),
    takenBranches,
  };
};
