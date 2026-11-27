import type { Agent, AgentId } from '@goodboy/types';
import { isFailureSettled } from './isFailureSettled';
import { msOf } from './msOf';

export type StandingFailure = Readonly<{
  agentId: AgentId;
  failedAt: number | null;
}>;

export type DelegationStanding = Readonly<{
  agentId: AgentId | null;
  isReplaced: boolean;
}>;

export type FailureStanding = Readonly<{
  failures: ReadonlyArray<StandingFailure>;
  endedAgentIds: ReadonlySet<AgentId>;
  failedAt: number | null;
  isEnded: boolean;
}>;

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly delegations?: ReadonlyArray<DelegationStanding>;
  readonly settledAt?: number | null;
};

type AgentParams = {
  readonly agent: Agent;
};

type SlotParams = {
  readonly failed: Agent;
  readonly agents: ReadonlyArray<Agent>;
};

const NO_DELEGATIONS: ReadonlyArray<DelegationStanding> = [];

const completedAtOf = ({ agent }: AgentParams): number | null => msOf({ value: agent.completedAt });

const slotOf = ({ agent }: AgentParams): string | null =>
  agent.stepId === undefined
    ? null
    : [
        agent.workflowRunId ?? '',
        agent.stepId,
        agent.parentAgentId ?? '',
        agent.mountId ?? '',
      ].join('|');

const isSlotRerun = ({ failed, agents }: SlotParams): boolean => {
  const slot = slotOf({ agent: failed });
  if (slot === null) {
    return false;
  }
  const failedAt = completedAtOf({ agent: failed });
  return agents.some((candidate) => {
    if (candidate.id === failed.id || candidate.status !== 'completed') {
      return false;
    }
    if (slotOf({ agent: candidate }) !== slot) {
      return false;
    }
    const completedAt = completedAtOf({ agent: candidate });
    return failedAt === null || completedAt === null
      ? candidate.ordinal > failed.ordinal
      : completedAt > failedAt;
  });
};

export const failureStandingOf = ({
  agents,
  delegations = NO_DELEGATIONS,
  settledAt = null,
}: Params): FailureStanding => {
  const rows = agents.filter((agent) => agent.deletedAt === undefined);
  const replaced = new Set(
    delegations.flatMap((delegation) =>
      delegation.isReplaced && delegation.agentId !== null ? [delegation.agentId] : [],
    ),
  );
  const ended = new Set<AgentId>(
    rows.filter((agent) => agent.status === 'completed').map((agent) => agent.id),
  );
  const failures: StandingFailure[] = [];
  for (const failed of rows.filter((agent) => agent.status === 'failed')) {
    const failedAt = completedAtOf({ agent: failed });
    const isOver =
      replaced.has(failed.id) ||
      isSlotRerun({ failed, agents: rows }) ||
      (failedAt !== null && isFailureSettled({ at: failedAt, settledAt }));
    if (isOver) {
      ended.add(failed.id);
      continue;
    }
    failures.push({ agentId: failed.id, failedAt });
  }
  const known = failures.flatMap((failure) =>
    failure.failedAt === null ? [] : [failure.failedAt],
  );
  const hasFailedRow = rows.some((agent) => agent.status === 'failed');
  return {
    failures,
    endedAgentIds: ended,
    failedAt: known.length === failures.length && known.length > 0 ? Math.max(...known) : null,
    isEnded: hasFailedRow && failures.length === 0,
  };
};
