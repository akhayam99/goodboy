import { useMemo } from 'react';
import type {
  AgentId,
  PrComment,
  ResolveCheckRun,
  ResolveSourceSnapshot,
  SessionId,
} from '@goodboy/types';
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
  projectReviewComment,
  reviewCommentStateOf,
  type ReviewCommentState,
} from '../../../reviewCommentState';
import { RESOLVE_LIST_WORDS, type ResolveWord } from '../../../commentProjection';
import { checksFailedItemIds } from '../../../checksFailedItemIds';
import { isBulkAcceptable } from '../../../bulkAccept';
import { isFixableThread } from '../../../fixableComments';
import type { ResolveCandidateWithItems } from '../../../../../store/slices/resolve/state';

export type ReviewEntry = {
  readonly row: ResolveQueueRow;
  readonly threadId: string;
  readonly state: ReviewCommentState;
  readonly resolveWord: ResolveWord;
  readonly word: string;
  readonly chips: ReadonlyArray<string>;
  readonly change: ReviewSourceChange | null;
  readonly newReplies: ReadonlyArray<PrComment>;
  readonly remote: ThreadRemoteKind | null;
  readonly facts: ThreadGitFacts | null;
  readonly view: RemoteView | null;
  readonly isChecking: boolean;
  readonly checkError: string | null;
  readonly checkAgentId: AgentId | null;
  readonly isFixable: boolean;
  readonly isAcceptable: boolean;
};

export type ReviewGroup = {
  readonly word: ResolveWord;
  readonly entries: ReadonlyArray<ReviewEntry>;
};

const EMPTY_DRAFTS: Readonly<Record<string, ResolveItemDraft>> = {};
const EMPTY_GIT: Readonly<Record<string, ThreadGitFacts>> = {};
const EMPTY_CHANGES: Readonly<Record<string, ResolveSourceSnapshot>> = {};
const EMPTY_RECHECKS: Readonly<Record<string, ThreadRecheck>> = {};
const EMPTY_CANDIDATES: ReadonlyArray<ResolveCandidateWithItems> = [];
const EMPTY_CHECK_RUNS: ReadonlyArray<ResolveCheckRun> = [];

export type ReviewEntryScope = 'comments' | 'notes' | 'all';

export const useReviewEntries = ({
  sessionId,
  scope = 'comments',
}: {
  readonly sessionId: SessionId;
  readonly scope?: ReviewEntryScope;
}): {
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly groups: ReadonlyArray<ReviewGroup>;
  readonly all: ReadonlyArray<ReviewEntry>;
} => {
  const rows = useResolveQueueRows({ sessionId, scope: 'displayed' });
  const changes = useAppStore((s) => s.sessionResolveSourceSnapshots[sessionId] ?? EMPTY_CHANGES);
  const { selected } = useActiveReviewSource({ sessionId });
  const kind = selected?.kind ?? null;
  const projectId = selected?.projectId ?? null;
  const number = selected?.number ?? null;
  const drafts = useAppStore((s) => s.resolveItemDrafts[sessionId] ?? EMPTY_DRAFTS);
  const threadGit = useAppStore((s) => s.sessionThreadGit[sessionId] ?? EMPTY_GIT);
  const rechecks = useAppStore((s) => s.sessionThreadRechecks[sessionId] ?? EMPTY_RECHECKS);
  const candidates = useAppStore((s) => s.sessionResolveCandidates[sessionId] ?? EMPTY_CANDIDATES);
  const checkRuns = useAppStore((s) => s.sessionResolveCheckRuns[sessionId] ?? EMPTY_CHECK_RUNS);
  const all = useMemo(() => {
    const failedChecks = checksFailedItemIds({ candidates, checkRuns });
    const ordered = groupConversationsByFile({ rows }).flatMap((group) => group.rows);
    return ordered.map((row): ReviewEntry => {
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
      const projection = projectReviewComment({
        state,
        row,
        gitChip: view,
        hasFailedChecks: failedChecks.has(row.item.id),
      });
      return {
        row,
        threadId: row.thread.threadId,
        state,
        resolveWord: projection.word,
        word: projection.label,
        chips: projection.chips,
        change: sourceChangeOf({ snapshot: changes[row.thread.threadId] }),
        newReplies:
          row.thread.stage === 'new'
            ? []
            : newRepliesOf({
                snapshot: changes[row.thread.threadId],
                replies: row.commentThread?.replies ?? [],
              }),
        remote,
        facts,
        view,
        isChecking,
        checkError: recheck?.error ?? null,
        checkAgentId: recheck?.agentId ?? null,
        isFixable: isFixableThread({ thread: row.thread }),
        isAcceptable: isBulkAcceptable({ state, remote }),
      };
    });
  }, [candidates, changes, checkRuns, drafts, rechecks, rows, threadGit]);
  return useMemo(() => {
    const shown = all.filter(({ row }) => {
      if (scope === 'all') {
        return true;
      }
      if (scope === 'notes') {
        return row.thread.originKind === 'diff_comment';
      }
      return (
        kind !== null && rowBelongsToSource({ row: row.thread, entry: { kind, projectId, number } })
      );
    });
    const groups = RESOLVE_LIST_WORDS.map((word) => ({
      word,
      entries: shown.filter((entry) => entry.resolveWord === word),
    })).filter((group) => group.entries.length > 0);
    return { entries: groups.flatMap((group) => group.entries), groups, all };
  }, [all, kind, number, projectId, scope]);
};
