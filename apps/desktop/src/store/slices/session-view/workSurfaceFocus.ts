import type { AgentId, SessionId } from '@goodboy/types';
import type { LensKind } from './types';

type Focus =
  | { readonly kind: 'lens'; readonly lens: LensKind | null }
  | { readonly kind: 'agent'; readonly agentId: AgentId | null }
  | { readonly kind: 'session-created'; readonly agentId: AgentId | null };

type Surface = {
  readonly activeLens: Readonly<Record<SessionId, LensKind | null>>;
  readonly selectedAgentId: Readonly<Record<SessionId, AgentId | null>>;
};

type Params = Surface & {
  readonly sessionId: SessionId;
  readonly focus: Focus;
};

export const workSurfaceFocus = ({
  sessionId,
  focus,
  activeLens,
  selectedAgentId,
}: Params): Surface => {
  switch (focus.kind) {
    case 'lens':
      return {
        activeLens: { ...activeLens, [sessionId]: focus.lens },
        selectedAgentId: { ...selectedAgentId, [sessionId]: null },
      };
    case 'agent':
      return {
        activeLens,
        selectedAgentId: { ...selectedAgentId, [sessionId]: focus.agentId },
      };
    case 'session-created':
      return {
        activeLens: { ...activeLens, [sessionId]: null },
        selectedAgentId: { ...selectedAgentId, [sessionId]: focus.agentId },
      };
    default: {
      const unreachable: never = focus;
      return unreachable;
    }
  }
};
