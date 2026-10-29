import type { Agent, AgentId, MountId, SessionId } from '@goodboy/types';
import { PUSH_FIXER_NAME } from './pushFixerName';
import type { BranchPushFix, PushFixFollowUp, PushFixOutcome } from '../types';

export type PushFixState =
  | { readonly kind: 'none' }
  | { readonly kind: 'working'; readonly agentId: AgentId }
  | {
      readonly kind: 'pushed';
      readonly agentId: AgentId;
      readonly isClaimed: boolean;
      readonly followUp: PushFixFollowUp | null;
    }
  | {
      readonly kind: 'failed';
      readonly agentId: AgentId;
      readonly step: 'agent' | 'push';
      readonly reason: string | null;
    };

type Params = {
  readonly fixes: Readonly<Record<AgentId, BranchPushFix>>;
  readonly outcomes: Readonly<Record<MountId, PushFixOutcome>>;
  readonly agents: ReadonlyArray<Agent> | undefined;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

type LiveParams = {
  readonly agents: ReadonlyArray<Agent> | undefined;
  readonly agentId: AgentId;
};

const WORKING_STATUSES: ReadonlySet<Agent['status']> = new Set(['pending', 'running']);

const isPushFixAgentLive = ({ agents, agentId }: LiveParams): boolean => {
  if (agents === undefined) {
    return true;
  }
  const agent = agents.find((candidate) => candidate.id === agentId);
  return agent !== undefined && agent.deletedAt === undefined && WORKING_STATUSES.has(agent.status);
};

export const pushFixStateOf = ({
  fixes,
  outcomes,
  agents,
  sessionId,
  mountId,
}: Params): PushFixState => {
  const tracked = Object.values(fixes).find(
    (fix) =>
      fix.sessionId === sessionId &&
      fix.mountId === mountId &&
      isPushFixAgentLive({ agents, agentId: fix.agentId }),
  );
  if (tracked !== undefined) {
    return { kind: 'working', agentId: tracked.agentId };
  }
  const running = (agents ?? []).find(
    (agent) =>
      agent.name === PUSH_FIXER_NAME &&
      agent.mountId === mountId &&
      agent.deletedAt === undefined &&
      WORKING_STATUSES.has(agent.status),
  );
  if (running !== undefined) {
    return { kind: 'working', agentId: running.id };
  }
  const outcome = outcomes[mountId];
  if (outcome !== undefined && outcome.sessionId === sessionId) {
    if (outcome.kind === 'pushed') {
      return {
        kind: 'pushed',
        agentId: outcome.agentId,
        isClaimed: outcome.isClaimed,
        followUp: outcome.followUp,
      };
    }
    return {
      kind: 'failed',
      agentId: outcome.agentId,
      step: outcome.kind === 'agent_failed' ? 'agent' : 'push',
      reason: outcome.reason,
    };
  }
  return { kind: 'none' };
};
