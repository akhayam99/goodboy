import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { invokeAgentUpdateStatus } from '../../../../features/workflows/workflows';
import type { SliceDeps } from '../../../slice-types';
import { selectWritableMounts } from '../../project-mounts/selectors';
import { isRunClosedOut } from '../runState/isRunClosedOut';
import { sessionById } from '../../sessions/sessionIndex';
import { WorkflowGateError } from '../workflowActivationGate';
import { placeAgent } from './placeAgent';
import { selectMountBlockedStep } from './selectMountBlockedStep';

export type MountBlockChoice =
  Readonly<{ kind: 'reattach' }> | Readonly<{ kind: 'use'; mountId: MountId }>;

type Params = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
  choice: MountBlockChoice;
}>;

const NOT_WAITING = 'This step is not waiting for a branch anymore.';

const NOT_IN_SESSION = 'That branch is not in this session anymore.';

const RUN_STOPPED = 'This run was stopped, so the step was not started.';

export const resolveMountBlockedStep = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, agentId, choice }: Params): Promise<void> => {
    const workflowRunId = (get().sessionPhaseRuns[sessionId] ?? []).find(
      (candidate) => candidate.id === agentId,
    )?.workflowRunId;
    if (workflowRunId == null) {
      throw new Error(NOT_WAITING);
    }
    const block = selectMountBlockedStep({
      state: get(),
      sessionId,
      workflowRunId,
      activeMountId: null,
    });
    if (block === null || block.agentId !== agentId) {
      throw new Error(NOT_WAITING);
    }
    if (choice.kind === 'reattach') {
      if (!block.isReattachable) {
        throw new Error(NOT_IN_SESSION);
      }
      await get().attachMount({ sessionId, mountId: block.mountId });
    }
    const stop = sessionById(get().sessions, sessionId)?.workflowRuns.find(
      (candidate) => candidate.id === workflowRunId,
    )?.orchestrationStop?.kind;
    if (
      isRunClosedOut({ get, sessionId, workflowRunId }) ||
      stop === 'operator' ||
      stop === 'closed'
    ) {
      throw new Error(RUN_STOPPED);
    }
    const current = (get().sessionPhaseRuns[sessionId] ?? []).find(
      (candidate) => candidate.id === agentId,
    );
    if (current?.status !== 'blocked') {
      throw new Error(NOT_WAITING);
    }
    const mountId = choice.kind === 'reattach' ? block.mountId : choice.mountId;
    if (
      !selectWritableMounts({ state: get(), sessionId }).some((mount) => mount.mountId === mountId)
    ) {
      throw new Error(NOT_IN_SESSION);
    }
    placeAgent({
      set,
      agent: await invokeAgentUpdateStatus(agentId, { status: 'pending', mountId }),
    });
    try {
      await get().activateWorkflowAgent({
        sessionId,
        agentId,
        focus: 'announce',
        bypassGate: true,
      });
    } catch (error) {
      if (error instanceof WorkflowGateError && error.reason === 'paused') {
        return;
      }
      placeAgent({ set, agent: await invokeAgentUpdateStatus(agentId, { status: 'blocked' }) });
      throw error;
    }
  };
};
