import type { AgentId, SessionId } from '@goodboy/types';
import type { LensKind, SessionStudio } from './types';

type Focus =
  | { readonly kind: 'lens'; readonly lens: LensKind | null }
  | { readonly kind: 'studio'; readonly studio: SessionStudio | null }
  | { readonly kind: 'agent'; readonly agentId: AgentId | null }
  | {
      readonly kind: 'session-created';
      readonly studio: SessionStudio | null;
      readonly agentId: AgentId | null;
    };

type Surface = {
  readonly activeLens: Readonly<Record<SessionId, LensKind | null>>;
  readonly sessionStudio: Readonly<Record<SessionId, SessionStudio | null>>;
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
  sessionStudio,
  selectedAgentId,
}: Params): Surface => {
  switch (focus.kind) {
    case 'lens':
      return {
        activeLens: { ...activeLens, [sessionId]: focus.lens },
        sessionStudio: { ...sessionStudio, [sessionId]: null },
        selectedAgentId: { ...selectedAgentId, [sessionId]: null },
      };
    case 'studio':
      return {
        activeLens,
        sessionStudio: { ...sessionStudio, [sessionId]: focus.studio },
        selectedAgentId:
          focus.studio === null ? selectedAgentId : { ...selectedAgentId, [sessionId]: null },
      };
    case 'agent':
      return {
        activeLens,
        sessionStudio:
          focus.agentId === null ? sessionStudio : { ...sessionStudio, [sessionId]: null },
        selectedAgentId: { ...selectedAgentId, [sessionId]: focus.agentId },
      };
    case 'session-created':
      return {
        activeLens: { ...activeLens, [sessionId]: null },
        sessionStudio: { ...sessionStudio, [sessionId]: focus.studio },
        selectedAgentId: {
          ...selectedAgentId,
          [sessionId]: focus.studio === null ? focus.agentId : null,
        },
      };
    default: {
      const unreachable: never = focus;
      return unreachable;
    }
  }
};
