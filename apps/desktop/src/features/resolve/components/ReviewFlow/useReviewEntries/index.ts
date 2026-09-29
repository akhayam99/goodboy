import { useMemo } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { ResolveItemDraft } from '../../../resolveItemDraft';
import type { ResolveQueueRow } from '../../../buildResolveQueueRows';
import { groupConversationsByFile } from '../../../groupConversationsByFile';
import { useResolveQueueRows } from '../../../hooks/useResolveQueueRows';
import { conversationSourceOf } from '../../../notes/conversationSource';
import { isReplyEdited } from '../../../reviewRows';
import { remoteOf, remoteViewOf, type RemoteView } from '../../../reviewRemote';
import type { ThreadRecheck } from '../../../../../store/slices/resolve/state';
import type {
  ThreadGitFacts,
  ThreadRemoteKind,
} from '../../../../../store/slices/resolve/threadGitState';
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
const EMPTY_RECHECKS: Readonly<Record<string, ThreadRecheck>> = {};

export const useReviewEntries = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): {
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly groups: ReadonlyArray<ReviewGroup>;
} => {
  const rows = useResolveQueueRows({ sessionId });
  const hasPr = useAppStore((s) => s.sessionGithub[sessionId]?.pr != null);
  const drafts = useAppStore((s) => s.resolveItemDrafts[sessionId] ?? EMPTY_DRAFTS);
  const threadGit = useAppStore((s) => s.sessionThreadGit[sessionId] ?? EMPTY_GIT);
  const rechecks = useAppStore((s) => s.sessionThreadRechecks[sessionId] ?? EMPTY_RECHECKS);
  return useMemo(() => {
    const shown = hasPr ? rows : rows.filter((row) => conversationSourceOf({ row }) === 'note');
    const ordered = groupConversationsByFile({ rows: shown }).flatMap((group) => group.rows);
    const entries = ordered.map((row): ReviewEntry => {
      const state = reviewCommentStateOf({
        row,
        isEdited: isReplyEdited({ draft: drafts[row.thread.threadId], row }),
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
  }, [drafts, hasPr, rechecks, rows, threadGit]);
};
