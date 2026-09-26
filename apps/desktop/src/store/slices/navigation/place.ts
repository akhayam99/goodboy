import type { AgentId, SessionId } from '@goodboy/types';
import type { LensKind, SessionStudio } from '../session-view/types';
import type { Place, PlaceRequest, SessionTarget } from './types';

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
};

export const BOARD_PLACE: Place = { at: 'board' };

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

export const agentPlace = ({ sessionId, agentId }: AgentPlaceParams): PlaceRequest => ({
  at: 'agent',
  sessionId,
  agentId,
});

type ResolverPageParams = AgentPlaceParams & {
  readonly threadId: string;
};

export const resolverPagePlace = ({ sessionId, agentId, threadId }: ResolverPageParams): Place =>
  sessionPlace({ sessionId, lens: 'review', agentId, target: { kind: 'thread', threadId } });
