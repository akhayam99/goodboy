import { useMemo } from 'react';
import type {
  AgentId,
  MountId,
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
  reviewCommentToneKeyOf,
  type ReviewCommentState,
  type ReviewCommentTone,
} from '../../../reviewCommentState';
import {
  RESOLVE_GROUP_OF_WORD,
  RESOLVE_LIST_GROUPS,
  RESOLVE_WORD_RANK,
  type ResolveGroup,
  type ResolveWord,
} from '../../../commentProjection';
import { checksFailedItemIds } from '../../../checksFailedItemIds';
import { isBulkAcceptable } from '../../../bulkAccept';
import { commentLaneOf, type CommentLane } from '../../../commentLaneOf';
import { useCommentRunThreadIds } from '../../../hooks/useCommentRunThreadIds';
import { rowFixOf, type RowFix } from '../../../rowFix';
import { heldLaunchIdOf } from '../../../../../store/slices/resolve/launchTurns';
import type { ResolveCandidateWithItems } from '../../../../../store/slices/resolve/state';
import type { CommentRunView } from '../../../commentRunViewsOf';
import { useCommentRuns } from '../../../hooks/useCommentRuns';

export type ReviewEntry = {
  readonly row: ResolveQueueRow;
  readonly threadId: string;
  readonly state: ReviewCommentState;
  readonly toneKey: ReviewCommentTone;
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
  readonly lane: CommentLane | null;
  readonly isFixable: boolean;
  readonly isAcceptable: boolean;
  readonly fix: RowFix | null;
  readonly run: CommentRunView | null;
};

export type ReviewGroup = {
  readonly group: ResolveGroup;
  readonly isRun?: boolean;
  readonly entries: ReadonlyArray<ReviewEntry>;
};

const EMPTY_DRAFTS: Readonly<Record<string, ResolveItemDraft>> = {};
const EMPTY_GIT: Readonly<Record<string, ThreadGitFacts>> = {};
const EMPTY_CHANGES: Readonly<Record<string, ResolveSourceSnapshot>> = {};
const EMPTY_RECHECKS: Readonly<Record<string, ThreadRecheck>> = {};
const EMPTY_CANDIDATES: ReadonlyArray<ResolveCandidateWithItems> = [];
const EMPTY_CHECK_RUNS: ReadonlyArray<ResolveCheckRun> = [];
const RUN_TONE: Partial<Record<ResolveWord, ReviewCommentTone>> = {
  in_run: 'drafting',
  run_finished: 'ready',
};

export type ReviewEntryScope = 'comments' | 'notes' | 'branch' | 'all';

export type ReviewEntryCounts = {
  readonly all: number;
  readonly notes: number;
  readonly host: number;
};

export const useReviewEntries = ({
  sessionId,
  scope = 'comments',
  mountId = null,
}: {
  readonly sessionId: SessionId;
  readonly scope?: ReviewEntryScope;
  readonly mountId?: MountId | null;
}): {
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly groups: ReadonlyArray<ReviewGroup>;
  readonly all: ReadonlyArray<ReviewEntry>;
  readonly counts: ReviewEntryCounts;
} => {
  const rows = useResolveQueueRows({ sessionId, scope: 'displayed', mountId });
  const changes = useAppStore((s) => s.sessionResolveSourceSnapshots[sessionId] ?? EMPTY_CHANGES);
  const { selected } = useActiveReviewSource({ sessionId, mountId });
  const kind = selected?.kind ?? null;
  const projectId = selected?.projectId ?? null;
  const number = selected?.number ?? null;
  const drafts = useAppStore((s) => s.resolveItemDrafts[sessionId] ?? EMPTY_DRAFTS);
  const threadGit = useAppStore((s) => s.sessionThreadGit[sessionId] ?? EMPTY_GIT);
  const rechecks = useAppStore((s) => s.sessionThreadRechecks[sessionId] ?? EMPTY_RECHECKS);
  const candidates = useAppStore((s) => s.sessionResolveCandidates[sessionId] ?? EMPTY_CANDIDATES);
  const checkRuns = useAppStore((s) => s.sessionResolveCheckRuns[sessionId] ?? EMPTY_CHECK_RUNS);
  const inRunThreadIds = useCommentRunThreadIds({ sessionId });
  const commentRuns = useCommentRuns({ sessionId });
  const all = useMemo(() => {
    const failedChecks = checksFailedItemIds({ candidates, checkRuns });
    const ordered = groupConversationsByFile({ rows }).flatMap((group) => group.rows);
    return ordered.map((row): ReviewEntry => {
      const isChanged = changes[row.thread.threadId]?.changed != null;
      const state = reviewCommentStateOf({
        row,
        isEdited: isReplyEdited({ draft: drafts[row.thread.threadId], row }),
        isChanged,
        isHeld: heldLaunchIdOf({ threadId: row.thread.threadId }) !== null,
      });
      const facts = threadGit[row.thread.threadId] ?? null;
      const remote = remoteOf({ state, facts });
      const recheck = rechecks[row.thread.threadId] ?? null;
      const isChecking = recheck !== null && recheck.error === null;
      const view =
        remote === null
          ? null
          : remoteViewOf({ remote, verdict: facts?.verdict ?? null, isChecking });
      const run = commentRuns.get(row.thread.threadId) ?? null;
      const projection = projectReviewComment({
        state,
        row,
        gitChip: view,
        hasFailedChecks: failedChecks.has(row.item.id),
        run,
        isSourceChanged: isChanged,
      });
      const lane = commentLaneOf({ row, inRunThreadIds });
      return {
        row,
        threadId: row.thread.threadId,
        state,
        toneKey: RUN_TONE[projection.word] ?? reviewCommentToneKeyOf({ state, row }),
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
        lane,
        isFixable: lane === 'fix',
        isAcceptable: isBulkAcceptable({ state, remote }),
        fix: rowFixOf({ state, row, projection }),
        run,
      };
    });
  }, [
    candidates,
    changes,
    checkRuns,
    commentRuns,
    drafts,
    inRunThreadIds,
    rechecks,
    rows,
    threadGit,
  ]);
  return useMemo(() => {
    const isNote = ({ row }: ReviewEntry): boolean => row.thread.originKind === 'diff_comment';
    const isHost = ({ row }: ReviewEntry): boolean =>
      kind !== null && rowBelongsToSource({ row: row.thread, entry: { kind, projectId, number } });
    const counts: ReviewEntryCounts = {
      all: all.filter((entry) => isNote(entry) || isHost(entry)).length,
      notes: all.filter(isNote).length,
      host: all.filter((entry) => !isNote(entry) && isHost(entry)).length,
    };
    const shown = all.filter((entry) => {
      if (scope === 'all') {
        return true;
      }
      if (scope === 'notes') {
        return isNote(entry);
      }
      if (scope === 'branch') {
        return isNote(entry) || isHost(entry);
      }
      return isHost(entry);
    });
    const groups = RESOLVE_LIST_GROUPS.map((group) => ({
      group,
      entries: shown
        .filter((entry) => RESOLVE_GROUP_OF_WORD[entry.resolveWord] === group)
        .sort(
          (left, right) =>
            RESOLVE_WORD_RANK[left.resolveWord] - RESOLVE_WORD_RANK[right.resolveWord],
        ),
    })).filter((group) => group.entries.length > 0);
    return { entries: groups.flatMap((group) => group.entries), groups, all, counts };
  }, [all, kind, number, projectId, scope]);
};
