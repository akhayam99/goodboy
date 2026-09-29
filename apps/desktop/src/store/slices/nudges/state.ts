import type { AgentId, PlanId, SessionId } from '@goodboy/types';
import type { AgentKind } from '../../../features/session/agent-kind';

export type SessionNudge =
  | {
      readonly kind: 'plan-ready';
      readonly id: string;
      readonly agentId: AgentId;
      readonly planId: PlanId | null;
      readonly planTitle: string;
    }
  | {
      readonly kind: 'handoff-suggested';
      readonly id: string;
      readonly agentId: AgentId;
      readonly targetKind: AgentKind;
      readonly reason: string;
      readonly planId: PlanId | null;
    };

export type NudgesState = {
  readonly sessionNudges: Readonly<Record<SessionId, SessionNudge | null>>;
};

export const nudgesInitialState: NudgesState = {
  sessionNudges: {},
};
