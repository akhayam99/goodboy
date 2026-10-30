import { runsForWorkflowRun } from '@goodboy/core';
import type { AgentId, MountId, SessionId, WorkflowRunId } from '@goodboy/types';
import type { AppState } from '../../../types';
import { selectWritableMounts } from '../../project-mounts/selectors';
import { pinnedMountIdOf } from './pinnedMountIdOf';

type State = Pick<AppState, 'sessionMounts' | 'sessionProjectMounts' | 'sessionPhaseRuns'>;

type Params = Readonly<{
  state: State;
  sessionId: SessionId;
  workflowRunId: WorkflowRunId;
  activeMountId: MountId | null;
}>;

export type MountChoice = Readonly<{
  mountId: MountId;
  branch: string;
}>;

export type MountBlockedStep = Readonly<{
  agentId: AgentId;
  stepNumber: number;
  mountId: MountId;
  branch: string | null;
  isReattachable: boolean;
  suggested: MountChoice | null;
  choices: ReadonlyArray<MountChoice>;
}>;

export const selectMountBlockedStep = ({
  state,
  sessionId,
  workflowRunId,
  activeMountId,
}: Params): MountBlockedStep | null => {
  const roots = runsForWorkflowRun(state.sessionPhaseRuns[sessionId] ?? [], workflowRunId)
    .filter((agent) => agent.parentAgentId == null)
    .sort((left, right) => left.ordinal - right.ordinal);
  const writable = selectWritableMounts({ state, sessionId });
  for (const [index, agent] of roots.entries()) {
    if (agent.status !== 'blocked') {
      continue;
    }
    const mountId = pinnedMountIdOf({ state, sessionId, agent });
    if (mountId === null || writable.some((mount) => mount.mountId === mountId)) {
      continue;
    }
    const view = (state.sessionMounts?.[sessionId] ?? []).find(
      (candidate) => candidate.id === mountId,
    );
    const choices = writable.map((mount) => ({ mountId: mount.mountId, branch: mount.branch }));
    const active = choices.find((choice) => choice.mountId === activeMountId) ?? null;
    const sole = choices.length === 1 ? (choices[0] ?? null) : null;
    return {
      agentId: agent.id,
      stepNumber: index + 1,
      mountId,
      branch: view?.branch ?? null,
      isReattachable:
        view !== undefined &&
        !view.isAttached &&
        view.diskState !== 'missing' &&
        view.diskState !== 'removed' &&
        (view.worktreePath ?? view.lastWorktreePath) !== null,
      suggested: active === null ? sole : active,
      choices,
    };
  }
  return null;
};
