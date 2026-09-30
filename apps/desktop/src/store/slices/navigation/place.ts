import type { AgentId, SessionId } from '@goodboy/types';
import type { LensKind, SessionStudio } from '../session-view/types';
import type { AgentPane, Place, PlaceRequest, SessionTarget } from './types';

type SessionPlaceParams = {
  readonly sessionId: SessionId;
  readonly lens?: LensKind | null;
  readonly agentId?: AgentId | null;
  readonly studio?: SessionStudio | null;
  readonly target?: SessionTarget | null;
};

type AgentPlaceParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly pane?: AgentPane | null;
};

export const BOARD_PLACE: Place = { at: 'board' };

export const SESSION_DRAFT_PLACE: Place = { at: 'session-draft' };

export const sessionPlace = ({
  sessionId,
  lens = null,
  agentId = null,
  studio = null,
  target = null,
}: SessionPlaceParams): Place => ({
  at: 'session',
  sessionId,
  view: { lens, agentId, studio, target },
});

export const agentPlace = ({ sessionId, agentId, pane = null }: AgentPlaceParams): PlaceRequest =>
  pane === null ? { at: 'agent', sessionId, agentId } : { at: 'agent', sessionId, agentId, pane };

type ResolverPageParams = AgentPlaceParams & {
  readonly threadId: string;
};

export const resolverPagePlace = ({
  sessionId,
  agentId,
  threadId,
  pane = null,
}: ResolverPageParams): Place =>
  sessionPlace({
    sessionId,
    lens: 'review',
    agentId,
    target: pane === null ? { kind: 'thread', threadId } : { kind: 'thread', threadId, pane },
  });
