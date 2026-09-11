import { resolveSettings } from '@goodboy/core';
import type { MountId, Project, ProjectId, SessionId } from '@goodboy/types';
import { DEFAULT_BRANCH_PREFIX } from '../../../features/settings/settings';
import { mountDirName } from '../project-mounts/mountDirName';
import { sanitizeSlug } from '../project-mounts/sanitizeSlug';
import { deriveBranchName } from './deriveBranchName';
import { materializationSeedFor } from './materializationSeeds';
import type { AppStore } from '../../store';

export type MountPlanState = Pick<
  AppStore,
  | 'sessions'
  | 'archivedSessions'
  | 'projects'
  | 'workspaceOverrides'
  | 'sessionWorktreeRecords'
  | 'sessionProjectMounts'
  | 'sessionExternalTasks'
>;

export type MountPlan = {
  readonly project: Project;
  readonly mountId: MountId;
  readonly prefix: string;
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
}: Params): MountPlan | null => {
  const session =
    state.sessions.find((candidate) => candidate.id === sessionId) ??
    Object.values(state.archivedSessions)
      .flat()
      .find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    return null;
  }
  const project = state.projects.find((candidate) => candidate.id === projectId);
  if (project === undefined || project.workspaceId !== session.workspaceId) {
    return null;
  }
  const seed = materializationSeedFor({ sessionId });
  const resolved = resolveSettings({
    global: {
      defaultProviderId: session.providerPreference.defaultProvider,
      defaultWorkflowId: null,
      defaultBranchPrefix: DEFAULT_BRANCH_PREFIX,
      parallelEnabled: false,
      defaultVerbosity: 'normal',
    },
    workspaceOverride: state.workspaceOverrides[session.workspaceId] ?? null,
    projectOverride: project.overrides,
  });
  const prefix = seed?.branchPrefix ?? resolved.defaultBranchPrefix;
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
  const derivedSlug = deriveBranchName({
    prefix,
    sessionId,
    goal: session.goal,
    ...(seed?.sessionSlug !== undefined ? { explicitSlug: seed.sessionSlug } : {}),
    taskIdentifiers: storedIdentifiers.length > 0 ? storedIdentifiers : taskIdentifiers,
    existingBranches: takenBranches,
  });
  const sanitizedSlug = sanitizeSlug(derivedSlug);
  const slug = sanitizedSlug === '' ? `session-${sessionId.slice(0, 8)}` : sanitizedSlug;
  const adoptedBranch = seed?.existingBranch ?? null;
  return {
    project,
    mountId,
    prefix,
    slug,
    branch: project.kind === 'repo' ? `${prefix}/${slug}` : null,
    adoptedBranch: project.kind === 'repo' ? adoptedBranch : null,
    baseBranch: project.kind === 'repo' ? (project.baseBranch ?? null) : null,
    targetPath: targetPathFor({ project, slug, mountId, folderName: seed?.folderName }),
    takenBranches,
  };
};
