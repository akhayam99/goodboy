import type { Agent, AgentId, DiffComment, MountId, SessionMountView } from '@goodboy/types';
import type { ResolveQueueRow } from '../../resolve/buildResolveQueueRows';
import { commentLaneOf, type CommentLane } from '../../resolve/commentLaneOf';
import { commentRunThreadIdsOf } from '../../resolve/commentRunThreadIdsOf';
import type { CommentRunEnd } from '../../resolve/commentRunViewsOf';
import { commentMountIdOf } from '../../resolve/commentMountIdOf';
import { COMMENT_RUN_COPY } from '../../resolve/commentRunCopy';
import { commentRunQuoteOf } from '../../resolve/commentRunQuoteOf';
import { commentRunSourceLabelOf } from '../../resolve/commentRunSourceLabelOf';
import { commentRunViewOfStore } from '../../resolve/commentRunViewOfStore';
import { joinableCommentRunsOf } from '../../resolve/joinableCommentRunsOf';
import { noteIdOfThread } from '../../resolve/notes/noteThread';
import { selectedReviewEntryOf } from '../../../store/slices/review-source/activeReviewSource';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import type { AppStore } from '../../../store/store';
import type { ReviewCommentActionTarget } from '../types';

type JoinRun = {
  readonly agentId: AgentId;
  readonly name: string;
};

export type ReviewCommentRunFacts = {
  readonly lane: CommentLane | null;
  readonly canStartRun: boolean;
  readonly runAgentId: AgentId | null;
  readonly runEnd: CommentRunEnd | null;
  readonly noteId: string | null;
  readonly runTitle: string;
  readonly runMountId: MountId | null;
  readonly runReply: string;
  readonly isSourceChanged: boolean;
  readonly changedQuote: string;
  readonly joinRuns: ReadonlyArray<JoinRun>;
  readonly quote: string;
};

type Params = {
  readonly state: AppStore;
  readonly target: Pick<ReviewCommentActionTarget, 'sessionId' | 'threadId'>;
  readonly row: ResolveQueueRow;
  readonly draftReply: string | null;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

const NO_NOTES: ReadonlyArray<DiffComment> = [];

const NO_MOUNTS: ReadonlyArray<SessionMountView> = [];

type QuoteParams = {
  readonly row: ResolveQueueRow;
  readonly body: string;
};

const threadQuoteOf = ({ row, body }: QuoteParams): string => {
  const note = row.reviewerNote;
  if (note === null) {
    return '';
  }
  const isNote = row.thread.originKind === 'diff_comment';
  return commentRunQuoteOf({
    comments: [
      {
        source: isNote
          ? COMMENT_RUN_COPY.localNoteSource
          : COMMENT_RUN_COPY.hostSource({ label: commentRunSourceLabelOf({ thread: row.thread }) }),
        author: note.author,
        body,
        path: note.path,
        line: note.line,
      },
    ],
  });
};

export const reviewCommentRunFactsOf = ({
  state,
  target: { sessionId, threadId },
  row,
  draftReply,
}: Params): ReviewCommentRunFacts => {
  const mountId = commentMountIdOf({
    thread: row.thread,
    notes: state.diffComments[sessionId] ?? NO_NOTES,
    mounts: state.sessionMounts[sessionId] ?? NO_MOUNTS,
    sourceMountId: selectedReviewEntryOf({ state, sessionId })?.mountId ?? null,
  });
  const run = commentRunViewOfStore({ state, sessionId, threadId });
  const changed = state.sessionResolveSourceSnapshots[sessionId]?.[threadId]?.changed ?? null;
  const isNote = row.thread.originKind === 'diff_comment';
  const agents = state.sessionPhaseRuns[sessionId] ?? NO_AGENTS;
  return {
    lane: commentLaneOf({ row, inRunThreadIds: new Set(commentRunThreadIdsOf({ agents })) }),
    canStartRun: sessionById(state.sessions, sessionId)?.workspaceId != null,
    runAgentId: run !== null && run.end === 'working' ? run.agentId : null,
    runEnd: run?.end ?? null,
    noteId: isNote ? (row.thread.diffCommentId ?? noteIdOfThread({ threadId })) : null,
    runTitle: run?.title ?? '',
    runMountId: run?.mountId ?? null,
    runReply: draftReply ?? run?.summary ?? '',
    isSourceChanged: changed !== null,
    changedQuote: changed === null ? '' : threadQuoteOf({ row, body: changed.body }),
    joinRuns: joinableCommentRunsOf({
      agents,
      threadId,
      mountId,
    }).map((agent) => ({ agentId: agent.id, name: agent.name })),
    quote: row.reviewerNote === null ? '' : threadQuoteOf({ row, body: row.reviewerNote.body }),
  };
};
