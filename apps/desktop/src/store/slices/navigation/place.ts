import type { AgentId, OpenQuestionId, SessionId } from '@goodboy/types';
import type { DiffFocus, LensKind } from '../session-view/types';
import { noteIdOfThread } from '../../../features/resolve/notes/noteThread';
import type { OpenDrawer } from '../drawer/state';
import { foldedLensOf } from './foldedLensOf';
import type { BranchTab, Place, PlaceRequest, SessionTarget } from './types';

type SessionPlaceParams = {
  readonly sessionId: SessionId;
  readonly lens?: LensKind | null;
  readonly agentId?: AgentId | null;
  readonly target?: SessionTarget | null;
};

type AgentPlaceParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const BOARD_PLACE: Place = { at: 'board' };

export const SESSION_DRAFT_PLACE: Place = { at: 'session-draft' };

export const sessionPlace = ({
  sessionId,
  lens = null,
  agentId = null,
  target = null,
}: SessionPlaceParams): Place => ({
  at: 'session',
  sessionId,
  view: { lens: foldedLensOf({ lens }), agentId, target },
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

type QuestionPlaceParams = {
  readonly sessionId: SessionId;
  readonly questionId: OpenQuestionId;
};

export const questionPlace = ({ sessionId, questionId }: QuestionPlaceParams): Place =>
  sessionPlace({ sessionId, lens: 'questions', target: { kind: 'question', questionId } });

export const agentPlace = ({ sessionId, agentId }: AgentPlaceParams): PlaceRequest => ({
  at: 'agent',
  sessionId,
  agentId,
});

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
  to: branchPlace({
    sessionId,
    mountPath,
    tab: threadId !== null && noteIdOfThread({ threadId }) !== null ? 'files' : 'comments',
    threadId,
  }),
  drawer: { kind: 'transcript', sessionId, payload: { agentId } },
});
