import type { AgentId, SessionId } from '@goodboy/types';
import type { DiffFocus, LensKind, SessionStudio } from '../session-view/types';
import type { OpenDrawer } from '../drawer/state';
import type { AgentPane, BranchTab, Place, PlaceRequest, SessionTarget } from './types';

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

type BranchPlaceParams = {
  readonly sessionId: SessionId;
  readonly mountPath?: string | null;
  readonly tab?: BranchTab;
  readonly threadId?: string | null;
  readonly focus?: DiffFocus | null;
};

export const branchPlace = ({
  sessionId,
  mountPath = null,
  tab = 'comments',
  threadId = null,
  focus = null,
}: BranchPlaceParams): Place =>
  sessionPlace({
    sessionId,
    lens: 'branch',
    target: { kind: 'branch', mountPath, tab, threadId, focus },
  });

export const agentPlace = ({ sessionId, agentId, pane = null }: AgentPlaceParams): PlaceRequest =>
  pane === null ? { at: 'agent', sessionId, agentId } : { at: 'agent', sessionId, agentId, pane };

type FixRunParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly threadId?: string | null;
  readonly mountPath?: string | null;
};

export type FixRunTranscript = {
  readonly to: Place;
  readonly drawer: OpenDrawer;
};

export const fixRunTranscript = ({
  sessionId,
  agentId,
  threadId = null,
  mountPath = null,
}: FixRunParams): FixRunTranscript => ({
  to: branchPlace({ sessionId, mountPath, tab: 'comments', threadId }),
  drawer: { kind: 'transcript', sessionId, payload: { agentId } },
});
