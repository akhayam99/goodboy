import type { SessionId } from '@goodboy/types';
import type { SuggestionProject } from './deriveNextSteps';
import { mountLabelOf } from './mountLabelOf';
import type { RebaseSuggestionTarget, SessionSuggestion } from './types';

type RebaseSuggestion = Extract<SessionSuggestion, { readonly kind: 'rebase-project' }>;

type Params = {
  readonly sessionId: SessionId;
  readonly projects: ReadonlyArray<SuggestionProject>;
};

type ProjectParams = {
  readonly project: SuggestionProject;
};

const dirtyCountOf = ({ project }: ProjectParams): number =>
  project.isClean === false ? Math.max(project.changedCount ?? 1, 1) : 0;

const isRebaseConsumed = ({ project }: ProjectParams): boolean => {
  const request = project.rebaseRequest ?? null;
  if (request == null || request.agentStatus === 'failed') {
    return false;
  }
  if (request.baseBranch != null && request.baseBranch !== project.baseBranch) {
    return false;
  }
  return request.behind === project.mainDistance;
};

type TargetParams = {
  readonly target: RebaseSuggestionTarget;
};

const isStopped = ({ target }: TargetParams): boolean => target.conflictCount !== undefined;

const stoppedDetailOf = ({ target }: TargetParams): string => {
  const conflicts = target.conflictCount ?? 0;
  if (conflicts === 0) {
    return 'Rebase stopped halfway';
  }
  return `Rebase stopped, ${conflicts === 1 ? '1 file has' : `${conflicts} files have`} conflicts`;
};

export const rebaseSuggestionOf = ({ sessionId, projects }: Params): RebaseSuggestion | null => {
  const targets: RebaseSuggestionTarget[] = [];
  const targetIds = new Set<string>();
  for (const project of projects) {
    const isProjectStopped = project.rebaseStop != null;
    const behind = project.mainDistance ?? 0;
    if (!isProjectStopped && (behind <= 0 || isRebaseConsumed({ project }))) {
      continue;
    }
    if (targetIds.has(project.id)) {
      continue;
    }
    targetIds.add(project.id);
    targets.push({
      id: project.id,
      mountId: project.mountId,
      projectId: project.projectId,
      projectName: project.projectName,
      branch: project.branch,
      worktreePath: project.worktreePath,
      baseBranch: project.baseBranch,
      behind,
      dirtyCount: dirtyCountOf({ project }),
      ...(project.rebaseStop != null && { conflictCount: project.rebaseStop.conflicts }),
    });
  }
  const shown = [...targets].sort((first, second) => {
    const stoppedGap = Number(isStopped({ target: second })) - Number(isStopped({ target: first }));
    if (stoppedGap !== 0) {
      return stoppedGap;
    }
    const behindGap = second.behind - first.behind;
    if (behindGap !== 0) {
      return behindGap;
    }
    return first.projectName.localeCompare(second.projectName);
  });
  const first = shown[0];
  if (first == null) {
    return null;
  }
  const fingerprint = `rebase-project:${sessionId}:${shown
    .map((target) => `${target.id}:${target.behind}${isStopped({ target }) ? ':stopped' : ''}`)
    .join(',')}`;
  if (isStopped({ target: first })) {
    return {
      id: `rebase-project:${sessionId}`,
      kind: 'rebase-project',
      priority: 9,
      band: 1,
      title: `Finish the rebase on ${mountLabelOf({ mount: first, siblings: projects })}`,
      detail: stoppedDetailOf({ target: first }),
      sessionId,
      targetKey: null,
      fingerprint,
      payload: { targets: shown },
    };
  }
  const projectCount = new Set(shown.map((target) => target.projectId)).size;
  const isSingleTarget = shown.length === 1;
  const isSingleProject = projectCount === 1;
  const behindDetail = isSingleTarget
    ? `${first.behind} behind`
    : isSingleProject
      ? `${shown.length} branches behind`
      : `${projectCount} folders behind`;
  return {
    id: `rebase-project:${sessionId}`,
    kind: 'rebase-project',
    priority: 40,
    band: 2,
    title: isSingleTarget
      ? `Rebase ${mountLabelOf({ mount: first, siblings: projects })} on ${first.baseBranch}`
      : isSingleProject
        ? `Rebase ${first.projectName}`
        : `Rebase ${shown.length} branches`,
    detail: behindDetail,
    sessionId,
    targetKey: null,
    fingerprint,
    payload: { targets: shown },
  };
};
