import { useMemo } from 'react';
import type { PrComment, ResolveSourceSnapshot, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { ResolveItemDraft } from '../../../resolveItemDraft';
import type { ResolveQueueRow } from '../../../buildResolveQueueRows';
import { groupConversationsByFile } from '../../../groupConversationsByFile';
import { useResolveQueueRows } from '../../../hooks/useResolveQueueRows';
import { conversationSourceOf } from '../../../notes/conversationSource';
import { isReplyEdited } from '../../../reviewRows';
import { REMOTE_WORD, remoteOf } from '../../../reviewRemote';
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
};

export type ReviewGroup = {
  readonly group: ReviewCommentGroup;
  readonly entries: ReadonlyArray<ReviewEntry>;
};

const EMPTY_DRAFTS: Readonly<Record<string, ResolveItemDraft>> = {};
const EMPTY_GIT: Readonly<Record<string, ThreadGitFacts>> = {};
const EMPTY_CHANGES: Readonly<Record<string, ResolveSourceSnapshot>> = {};

export const useReviewEntries = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): {
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly groups: ReadonlyArray<ReviewGroup>;
} => {
  const rows = useResolveQueueRows({ sessionId });
  const changes = useAppStore((s) => s.sessionResolveSourceSnapshots[sessionId] ?? EMPTY_CHANGES);
  const hasPr = useAppStore((s) => s.sessionGithub[sessionId]?.pr != null);
  const drafts = useAppStore((s) => s.resolveItemDrafts[sessionId] ?? EMPTY_DRAFTS);
  const threadGit = useAppStore((s) => s.sessionThreadGit[sessionId] ?? EMPTY_GIT);
  return useMemo(() => {
    const shown = hasPr ? rows : rows.filter((row) => conversationSourceOf({ row }) === 'note');
    const ordered = groupConversationsByFile({ rows: shown }).flatMap((group) => group.rows);
    const entries = ordered.map((row): ReviewEntry => {
      const state = reviewCommentStateOf({
        row,
        isEdited: isReplyEdited({ draft: drafts[row.thread.threadId], row }),
        isChanged: changes[row.thread.threadId]?.changed != null,
      });
      const facts = threadGit[row.thread.threadId] ?? null;
      const remote = remoteOf({ state, facts });
      return {
        row,
        threadId: row.thread.threadId,
        state,
        word: remote === null ? reviewCommentWord({ state, row }) : REMOTE_WORD[remote],
        change: sourceChangeOf({ snapshot: changes[row.thread.threadId] }),
        newReplies:
          row.thread.stage === 'new'
            ? []
            : newRepliesOf({
                snapshot: changes[row.thread.threadId],
                replies: row.commentThread?.replies ?? [],
              }),
        group: remote === null ? reviewCommentGroup({ state }) : 'open',
        remote,
        facts,
      };
    });
    const groups = REVIEW_COMMENT_GROUPS.map((group) => ({
      group,
      entries: entries.filter((entry) => entry.group === group),
    })).filter((group) => group.entries.length > 0);
    return { entries: groups.flatMap((group) => group.entries), groups };
  }, [changes, drafts, hasPr, rows, threadGit]);
};
