import { useMemo } from 'react';
import type { AgentId, PrComment, ResolveSourceSnapshot, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { ResolveItemDraft } from '../../../resolveItemDraft';
import type { ResolveQueueRow } from '../../../buildResolveQueueRows';
import { groupConversationsByFile } from '../../../groupConversationsByFile';
import { useResolveQueueRows } from '../../../hooks/useResolveQueueRows';
import { useActiveReviewSource } from '../../../hooks/useActiveReviewSource';
import { rowBelongsToSource } from '../../../../../store/slices/review-source/rowBelongsToSource';
import { isReplyEdited } from '../../../reviewRows';
import { remoteOf, remoteViewOf, type RemoteView } from '../../../reviewRemote';
import type { ThreadRecheck } from '../../../../../store/slices/resolve/state';
import type {
  ThreadGitFacts,
  ThreadRemoteKind,
} from '../../../../../store/slices/resolve/threadGitState';
import { newRepliesOf, sourceChangeOf, type ReviewSourceChange } from '../../../sourceChangeOf';
import {
  REVIEW_COMMENT_GROUPS,
  reviewCommentGroup,
  reviewCommentStateOf,
  reviewCommentWord,
  type ReviewCommentGroup,
  type ReviewCommentState,
} from '../../../reviewCommentState';

export type ReviewEntry = {
  readonly row: ResolveQueueRow;
  readonly threadId: string;
  readonly state: ReviewCommentState;
  readonly word: string;
  readonly change: ReviewSourceChange | null;
  readonly newReplies: ReadonlyArray<PrComment>;
  readonly group: ReviewCommentGroup;
  readonly remote: ThreadRemoteKind | null;
  readonly facts: ThreadGitFacts | null;
  readonly view: RemoteView | null;
  readonly isChecking: boolean;
  readonly checkError: string | null;
  readonly checkAgentId: AgentId | null;
};

export type ReviewGroup = {
  readonly group: ReviewCommentGroup;
  readonly entries: ReadonlyArray<ReviewEntry>;
};

const EMPTY_DRAFTS: Readonly<Record<string, ResolveItemDraft>> = {};
const EMPTY_GIT: Readonly<Record<string, ThreadGitFacts>> = {};
const EMPTY_CHANGES: Readonly<Record<string, ResolveSourceSnapshot>> = {};
const EMPTY_RECHECKS: Readonly<Record<string, ThreadRecheck>> = {};

export const useReviewEntries = ({
  sessionId,
  isSourceScoped = true,
}: {
  readonly sessionId: SessionId;
  readonly isSourceScoped?: boolean;
}): {
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly groups: ReadonlyArray<ReviewGroup>;
} => {
  const rows = useResolveQueueRows({ sessionId, scope: 'displayed' });
  const changes = useAppStore((s) => s.sessionResolveSourceSnapshots[sessionId] ?? EMPTY_CHANGES);
  const { selected } = useActiveReviewSource({ sessionId });
  const { kind, projectId, number } = selected;
  const drafts = useAppStore((s) => s.resolveItemDrafts[sessionId] ?? EMPTY_DRAFTS);
  const threadGit = useAppStore((s) => s.sessionThreadGit[sessionId] ?? EMPTY_GIT);
  const rechecks = useAppStore((s) => s.sessionThreadRechecks[sessionId] ?? EMPTY_RECHECKS);
  return useMemo(() => {
    const shown = isSourceScoped
      ? rows.filter(
          (row) =>
            row.thread.originKind === 'diff_comment' ||
            rowBelongsToSource({ row: row.thread, entry: { kind, projectId, number } }),
        )
      : rows;
    const ordered = groupConversationsByFile({ rows: shown }).flatMap((group) => group.rows);
    const entries = ordered.map((row): ReviewEntry => {
      const state = reviewCommentStateOf({
        row,
        isEdited: isReplyEdited({ draft: drafts[row.thread.threadId], row }),
        isChanged: changes[row.thread.threadId]?.changed != null,
      });
      const facts = threadGit[row.thread.threadId] ?? null;
      const remote = remoteOf({ state, facts });
      const recheck = rechecks[row.thread.threadId] ?? null;
      const isChecking = recheck !== null && recheck.error === null;
      const view =
        remote === null
          ? null
          : remoteViewOf({ remote, verdict: facts?.verdict ?? null, isChecking });
      return {
        row,
        threadId: row.thread.threadId,
        state,
        word: view === null ? reviewCommentWord({ state, row }) : view.word,
        change: sourceChangeOf({ snapshot: changes[row.thread.threadId] }),
        newReplies:
          row.thread.stage === 'new'
            ? []
            : newRepliesOf({
                snapshot: changes[row.thread.threadId],
                replies: row.commentThread?.replies ?? [],
              }),
        group: view === null ? reviewCommentGroup({ state }) : 'open',
        remote,
        facts,
        view,
        isChecking,
        checkError: recheck?.error ?? null,
        checkAgentId: recheck?.agentId ?? null,
      };
    });
    const groups = REVIEW_COMMENT_GROUPS.map((group) => ({
      group,
      entries: entries.filter((entry) => entry.group === group),
    })).filter((group) => group.entries.length > 0);
    return { entries: groups.flatMap((group) => group.entries), groups };
  }, [changes, drafts, isSourceScoped, kind, number, projectId, rechecks, rows, threadGit]);
};
