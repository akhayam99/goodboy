import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BranchCommit, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { isHistoryRunActive } from '../../../../store/slices/history/isHistoryRunActive';
import { selectActiveMount } from '../../../../store/slices/project-mounts/selectors';
import { activeReviewSourceOf } from '../../../../store/slices/review-source/activeReviewSource';
import { selectReviewCommitPreset } from '../../../../store/slices/reviewCommits/selectReviewCommitPreset';
import {
  EDIT_POSTED_REPLY_OFF,
  EDIT_POSTED_REPLY_ON,
  editPostedReplyKey,
  isEditPostedReplyOn,
} from '../../editPostedReplySetting';
import {
  hasReviewRewrite,
  isHistoryPlanDraft,
  predictedConflicts,
  presetChoices,
  presetOf,
  replacedOnOrigin,
  reviewAfterCommits,
  reviewCommitRows,
  reviewDraftSignature,
  reviewPlanItems,
  reviewReplyPreviews,
  samePlanItems,
  type ReviewCommitChoice,
  type ReviewCommitChoices,
  type ReviewCommitPreset,
  type ReviewThreadCommits,
} from '../../reviewCommits';
import { threadLocationOf } from '../../threadLocationOf';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

type Params = {
  readonly sessionId: SessionId;
  readonly entries: ReadonlyArray<ReviewEntry>;
};

const EMPTY_COMMITS: ReadonlyArray<BranchCommit> = [];

const threadsOf = ({
  entries,
}: {
  readonly entries: ReadonlyArray<ReviewEntry>;
}): ReadonlyArray<ReviewThreadCommits> =>
  entries.map((entry) => {
    const integrated = entry.row.item.integratedSha;
    return {
      threadId: entry.threadId,
      author: entry.row.reviewerNote?.author ?? null,
      location: threadLocationOf({ row: entry.row })?.shortLabel ?? null,
      commitShas: [
        ...(entry.row.thread.commitShas ?? []),
        ...(integrated === null ? [] : [integrated]),
      ],
      fixupOfSha: entry.row.thread.fixupOfSha,
    };
  });

type RewriteStage = 0 | 1 | 2 | 3;

export const useReviewCommits = ({ sessionId, entries }: Params) => {
  const mountId = useAppStore((s) => selectActiveMount({ state: s, sessionId })?.mountId ?? null);
  const projectId = useAppStore(
    (s) => selectActiveMount({ state: s, sessionId })?.projectId ?? null,
  );
  const worktreePath = useAppStore(
    (s) => selectActiveMount({ state: s, sessionId })?.worktreePath ?? null,
  );
  const branch = useAppStore((s) => selectActiveMount({ state: s, sessionId })?.branch ?? null);
  const draft = useAppStore((s) => (mountId === null ? null : (s.historyDrafts[mountId] ?? null)));
  const run = useAppStore((s) => (mountId === null ? null : (s.historyRuns[mountId] ?? null)));
  const prNumber = useAppStore(
    (s) => activeReviewSourceOf({ state: s, sessionId })?.prNumber ?? null,
  );
  const workspaceId = useAppStore((s) => sessionById(s.sessions, sessionId)?.workspaceId ?? null);
  const editKey = workspaceId === null ? null : editPostedReplyKey({ workspaceId });
  const rawEdit = useAppStore((s) => (editKey === null ? undefined : s.settings[editKey]));
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const remembered = useAppStore((s) => selectReviewCommitPreset({ state: s, projectId }));
  const loadHistoryDraft = useAppStore((s) => s.loadHistoryDraft);
  const editHistoryDraft = useAppStore((s) => s.editHistoryDraft);
  const applyHistoryDraft = useAppStore((s) => s.applyHistoryDraft);
  const restoreHistory = useAppStore((s) => s.restoreHistory);
  const loadReviewCommitPreset = useAppStore((s) => s.loadReviewCommitPreset);
  const chooseReviewCommitPreset = useAppStore((s) => s.chooseReviewCommitPreset);
  const openRewriteHistory = useAppStore((s) => s.openRewriteHistory);
  const ownDraft = useAppStore((s) =>
    mountId === null ? null : (s.reviewCommitDrafts[mountId] ?? null),
  );
  const loadReviewCommitDraft = useAppStore((s) => s.loadReviewCommitDraft);
  const markReviewCommitDraft = useAppStore((s) => s.markReviewCommitDraft);
  const [ownershipMountId, setOwnershipMountId] = useState<string | null>(null);
  const [replaceFor, setReplaceFor] = useState<string | null>(null);
  const [picked, setPicked] = useState<ReviewCommitChoices | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mountId === null) {
      return;
    }
    void loadHistoryDraft({ sessionId, mountId });
  }, [loadHistoryDraft, mountId, sessionId]);

  useEffect(() => {
    if (mountId === null) {
      return;
    }
    let isLive = true;
    void loadReviewCommitDraft({ mountId })
      .catch(() => undefined)
      .then(() => {
        if (isLive) {
          setOwnershipMountId(mountId);
        }
      });
    return () => {
      isLive = false;
    };
  }, [loadReviewCommitDraft, mountId]);

  useEffect(() => {
    if (editKey !== null) {
      void loadSetting(editKey);
    }
  }, [editKey, loadSetting]);

  useEffect(() => {
    if (projectId === null) {
      return;
    }
    void loadReviewCommitPreset({ projectId });
  }, [loadReviewCommitPreset, projectId]);

  const commits = draft?.commits ?? EMPTY_COMMITS;
  const threads = useMemo(() => threadsOf({ entries }), [entries]);
  const rows = useMemo(() => reviewCommitRows({ commits, threads }), [commits, threads]);
  const choices = useMemo(
    () => picked ?? presetChoices({ rows, preset: remembered, prNumber }),
    [picked, prNumber, remembered, rows],
  );
  const items = useMemo(() => reviewPlanItems({ rows, choices }), [choices, rows]);
  const preset = useMemo(() => presetOf({ rows, choices, prNumber }), [choices, prNumber, rows]);
  const isBusy = run !== null && isHistoryRunActive({ phase: run.phase });
  const isDraftCurrent =
    draft !== null && draft.onto === null && samePlanItems({ left: draft.items, right: items });
  const draftSignature =
    draft === null
      ? null
      : reviewDraftSignature({ headSha: draft.headSha, items: draft.items, onto: draft.onto });
  const isOwnershipKnown = mountId !== null && ownershipMountId === mountId;
  const isForeign =
    draft !== null &&
    !isDraftCurrent &&
    isHistoryPlanDraft({ commits: draft.commits, items: draft.items, onto: draft.onto }) &&
    draftSignature !== ownDraft &&
    draftSignature !== replaceFor;
  const headSha = draft?.headSha ?? null;

  const writeDraft = useCallback(
    async ({ next }: { readonly next: typeof items }): Promise<void> => {
      if (mountId === null || headSha === null) {
        return;
      }
      void markReviewCommitDraft({
        mountId,
        signature: reviewDraftSignature({ headSha, items: next, onto: null }),
      });
      await editHistoryDraft({ sessionId, mountId, items: next, onto: null });
    },
    [editHistoryDraft, headSha, markReviewCommitDraft, mountId, sessionId],
  );

  useEffect(() => {
    if (draft === null || mountId === null || isBusy || isStarting || !isOwnershipKnown) {
      return;
    }
    if (draft.commits.length === 0 || draft.items.length !== items.length || isDraftCurrent) {
      return;
    }
    if (isForeign) {
      return;
    }
    void writeDraft({ next: items });
  }, [
    draft,
    isBusy,
    isDraftCurrent,
    isForeign,
    isOwnershipKnown,
    isStarting,
    items,
    mountId,
    writeDraft,
  ]);

  const prediction = isDraftCurrent && !draft.isPredicting ? draft.prediction : null;
  const isPredicting = !isDraftCurrent || draft.isPredicting;
  const after = useMemo(
    () => reviewAfterCommits({ rows, items, prediction }),
    [items, prediction, rows],
  );
  const replies = useMemo(
    () =>
      reviewReplyPreviews({ rows, after }).flatMap((preview) => {
        const entry = entries.find((candidate) => candidate.threadId === preview.threadId);
        if (entry === undefined || entry.state === 'skipped') {
          return [];
        }
        return [
          {
            ...preview,
            text: (entry.row.thread.replyDraft ?? '').trim(),
            isPosted: entry.row.thread.replyPostedAt !== null,
          },
        ];
      }),
    [after, entries, rows],
  );
  const isEditingPosted = isEditPostedReplyOn({ raw: rawEdit });
  const setEditingPosted = useCallback(
    (next: boolean): void => {
      if (editKey !== null) {
        void saveSetting(editKey, next ? EDIT_POSTED_REPLY_ON : EDIT_POSTED_REPLY_OFF).catch(
          () => undefined,
        );
      }
    },
    [editKey, saveSetting],
  );
  const conflicts = predictedConflicts({ prediction });
  const replaced = replacedOnOrigin({ rows, items });
  const hasChange = hasReviewRewrite({ rows, items });
  const isMine = run !== null && startedAt !== null && run.updatedAt >= startedAt;
  const mine = isMine ? run : null;
  const isDone =
    mine !== null &&
    (mine.phase === 'applied' || mine.phase === 'pushed') &&
    mine.backupRef !== null;
  const isWorking = isStarting || (mine !== null && isHistoryRunActive({ phase: mine.phase }));
  const canRewrite =
    hasChange &&
    !isBusy &&
    !isWorking &&
    !isForeign &&
    isOwnershipKnown &&
    conflicts.length === 0 &&
    mountId !== null &&
    !isDone;

  const stage: RewriteStage = (() => {
    if (mine === null || mine.phase === 'trying') {
      const progress = mine?.progress ?? null;
      return progress !== null && (progress.stage === 'check' || progress.stage === 'cleanup')
        ? 1
        : 0;
    }
    if (mine.phase === 'pushing') {
      return 3;
    }
    return 2;
  })();

  const choosePreset = useCallback(
    (next: ReviewCommitPreset): void => {
      setPicked(presetChoices({ rows, preset: next, prNumber }));
      if (projectId !== null) {
        void chooseReviewCommitPreset({ projectId, preset: next }).catch(() => undefined);
      }
    },
    [chooseReviewCommitPreset, prNumber, projectId, rows],
  );

  const setChoice = useCallback(
    ({ sha, choice }: { readonly sha: string; readonly choice: ReviewCommitChoice }): void => {
      const { [sha]: _dropped, ...rest } = choices;
      setPicked(choice.kind === 'keep' ? rest : { ...rest, [sha]: choice });
    },
    [choices],
  );

  const reset = useCallback((): void => setPicked({}), []);

  const rewrite = useCallback(async (): Promise<void> => {
    if (!canRewrite || mountId === null) {
      return;
    }
    setError(null);
    setIsStarting(true);
    setStartedAt(Date.now());
    try {
      if (!isDraftCurrent) {
        await writeDraft({ next: items });
      }
      await applyHistoryDraft({ sessionId, mountId, shouldPush: replaced > 0 });
      setPicked(null);
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setIsStarting(false);
    }
  }, [
    applyHistoryDraft,
    canRewrite,
    isDraftCurrent,
    items,
    mountId,
    replaced,
    sessionId,
    writeDraft,
  ]);

  const undo = useCallback(async (): Promise<void> => {
    if (mountId === null || mine === null || mine.backupRef === null) {
      return;
    }
    setError(null);
    setStartedAt(Date.now());
    await restoreHistory({
      sessionId,
      mountId,
      backupRef: mine.backupRef,
      shouldPush: mine.phase === 'pushed',
    }).catch((caught: unknown) => setError(formatError(caught)));
  }, [mine, mountId, restoreHistory, sessionId]);

  const openHistory = useCallback((): void => {
    openRewriteHistory(sessionId, worktreePath);
  }, [openRewriteHistory, sessionId, worktreePath]);

  const replaceDraft = useCallback((): void => setReplaceFor(draftSignature), [draftSignature]);

  const retry = useCallback((): void => {
    if (mountId !== null) {
      void loadHistoryDraft({ sessionId, mountId });
    }
  }, [loadHistoryDraft, mountId, sessionId]);

  return {
    mountId,
    branch,
    draft,
    rows,
    choices,
    preset,
    after,
    replies,
    isEditingPosted,
    setEditingPosted,
    prediction,
    isPredicting,
    conflicts,
    replaced,
    hasChange,
    canRewrite,
    isForeign: isForeign && isOwnershipKnown,
    replaceDraft,
    isBusy,
    isWorking,
    isDone,
    run: mine,
    stage,
    error,
    choosePreset,
    setChoice,
    reset,
    rewrite,
    undo,
    openHistory,
    retry,
  };
};

export type ReviewCommitsModel = ReturnType<typeof useReviewCommits>;
