import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { ResolveCheckRun, ResolveQueueItemWithThread, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openUrl } from '../../../../shared/lib/editor';
import { useAgentMetrics } from '../../../session/hooks/useAgentMetrics';
import type { ScriptGroup } from '../../../scripts/scripts';
import { acceptedItemIds } from '../../acceptedItemIds';
import { summariseResolveChecks } from '../../checkReceipts';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';
import { useResolveCandidateDiff } from '../../hooks/useResolveCandidateDiff';
import { useResolveItemDraft } from '../../hooks/useResolveItemDraft';
import { refuseBlockedReason } from '../../refuseBlockedReason';
import { candidateHeadSha, selectResolveCandidate } from '../../selectResolveCandidate';
import { selectResolveCheckScript } from '../../selectResolveCheckScript';
import { sharedCandidateBlocker, sharedCandidateThreadIds } from '../../sharedCandidateThreadIds';
import { resolveItemActions, type ResolveItemActionId } from '../../resolveItemActions';
import {
  PARTIAL_ACCEPTANCE,
  PARTIAL_REFUSAL,
} from '../../../../store/slices/resolve/acceptResolveQueueItem';
import type { ResolveCandidateWithItems } from '../../../../store/slices/resolve/state';
import { ResolveItemView } from './index';
import type { ResolveDecisionMode, ResolveItemDraft } from '../../resolveItemDraft';

type RequestAttemptParams = { readonly threadId: string; readonly instruction: string };
type ReviewPublicationParams = { readonly threadId: string; readonly reconcile: boolean };
type Props = {
  readonly sessionId: SessionId;
  readonly prNumber?: number;
  readonly row: ResolveQueueRow;
  readonly allRows: ReadonlyArray<ResolveQueueRow>;
  readonly worktreePath: string | null;
  readonly onSelect: (threadId: string | null, excludedThreadIds?: ReadonlyArray<string>) => void;
  readonly nextThreadId?: string | null;
  readonly onRequestAttempt?: (params: RequestAttemptParams) => Promise<boolean>;
  readonly onAskForChanges?: (params: RequestAttemptParams) => boolean;
  readonly onOpenInDiff: (params: {
    readonly threadId: string;
    readonly sha: string;
    readonly path: string | null;
    readonly line: number | null;
  }) => void;
  readonly onBack?: () => void;
  readonly onPrevious?: () => void;
  readonly onNext?: () => void;
  readonly canPrevious?: boolean;
  readonly canNext?: boolean;
  readonly onReviewPublication?: (params: ReviewPublicationParams) => void;
};

const EMPTY_CANDIDATES: ReadonlyArray<ResolveCandidateWithItems> = [];
const EMPTY_CHECK_RUNS: ReadonlyArray<ResolveCheckRun> = [];
const EMPTY_QUEUE_ITEMS: ReadonlyArray<ResolveQueueItemWithThread> = [];
const EMPTY_SCRIPT_GROUPS: ReadonlyArray<ScriptGroup> = [];
const EMPTY_ITEM_DRAFTS: Readonly<Record<string, ResolveItemDraft>> = {};
const COULD_NOT_SEND =
  'This comment is no longer on the pull request, so the agent cannot be asked about it';
type GuardParams = Readonly<{ run: () => Promise<void>; onSuccess?: () => void }>;
type ApproveBlockerParams = {
  readonly row: ResolveQueueRow;
  readonly isApprovable: boolean;
  readonly sharedBlocker: 'deferred' | 'wont_fix' | null;
};

const approveBlockedReasonFor = ({
  row,
  isApprovable,
  sharedBlocker,
}: ApproveBlockerParams): string | null => {
  if (sharedBlocker === 'deferred') {
    return PARTIAL_ACCEPTANCE;
  }
  if (sharedBlocker === 'wont_fix') {
    return PARTIAL_REFUSAL;
  }
  if (!isApprovable) {
    return 'There is no fix or reply to approve';
  }
  return row.status === 'fix_ready' || row.status === 'reply_ready'
    ? null
    : 'This comment is not ready for approval';
};

type AttemptModeParams = { readonly id: ResolveItemActionId };

const attemptModeFor = ({ id }: AttemptModeParams): ResolveDecisionMode => {
  if (id === 'answer_agent') {
    return 'answer';
  }
  if (id === 'request_revision') {
    return 'revise';
  }
  if (id === 'retry_agent') {
    return 'retry';
  }
  return id === 'restart_agent' ? 'restart' : 'start';
};

export const ResolveItemContainer = ({
  sessionId,
  prNumber = 0,
  row,
  allRows,
  worktreePath,
  onSelect,
  nextThreadId,
  onRequestAttempt,
  onAskForChanges,
  onOpenInDiff,
  onBack = () => undefined,
  onPrevious = () => undefined,
  onNext = () => undefined,
  canPrevious = false,
  canNext = false,
  onReviewPublication = () => undefined,
}: Props) => {
  const candidates = useAppStore((s) => s.sessionResolveCandidates[sessionId] ?? EMPTY_CANDIDATES);
  const checkRuns = useAppStore((s) => s.sessionResolveCheckRuns[sessionId] ?? EMPTY_CHECK_RUNS);
  const queueItems = useAppStore((s) => s.sessionResolveQueueItems[sessionId] ?? EMPTY_QUEUE_ITEMS);
  const itemDrafts = useAppStore((s) => s.resolveItemDrafts[sessionId] ?? EMPTY_ITEM_DRAFTS);
  const scriptGroups = useAppStore(
    (s) =>
      (worktreePath === null ? undefined : s.discoveredScripts[sessionId]?.[worktreePath]) ??
      EMPTY_SCRIPT_GROUPS,
  );
  const acceptResolveQueueItem = useAppStore((s) => s.acceptResolveQueueItem);
  const refuseResolveQueueItem = useAppStore((s) => s.refuseResolveQueueItem);
  const takeUpResolveQueueItem = useAppStore((s) => s.takeUpResolveQueueItem);
  const reopenResolveQueueItem = useAppStore((s) => s.reopenResolveQueueItem);
  const runResolveCheck = useAppStore((s) => s.runResolveCheck);
  const forceCloseResolver = useAppStore((s) => s.forceCloseResolver);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const loadDiscoveredScripts = useAppStore((s) => s.loadDiscoveredScripts);
  const metrics = useAgentMetrics({ sessionId });
  const threadId = row.thread.threadId;
  const { reply, instruction, mode, setReply, setInstruction, setMode } = useResolveItemDraft({
    sessionId,
    threadId,
    proposal: row.proposal,
  });
  const [isBusy, setIsBusy] = useState(false);
  const [isCheckRunning, setIsCheckRunning] = useState(false);
  const [unprovable, setUnprovable] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentThreadIdRef = useRef(threadId);
  currentThreadIdRef.current = threadId;
  const isOpenRef = useRef(true);
  useEffect(
    () => () => {
      isOpenRef.current = false;
    },
    [],
  );
  const isStillSelected = useCallback(
    () => isOpenRef.current && currentThreadIdRef.current === threadId,
    [threadId],
  );

  useEffect(() => {
    if (worktreePath !== null) {
      void loadDiscoveredScripts({ sessionId, worktreePath });
    }
  }, [loadDiscoveredScripts, sessionId, worktreePath]);

  const candidate = useMemo(
    () => selectResolveCandidate({ candidates, itemId: row.item.id }),
    [candidates, row.item.id],
  );
  const diff = useResolveCandidateDiff({ candidate });
  const checks = useMemo(
    () =>
      summariseResolveChecks({
        runs: checkRuns.filter((run) => run.candidateId === candidate?.id),
        candidate,
        acceptedSet: acceptedItemIds({ entries: queueItems }),
      }),
    [candidate, checkRuns, queueItems],
  );
  const coveredRows = useMemo(
    () =>
      row.coveredThreadIds.flatMap((coveredId) =>
        allRows.filter((item) => item.thread.threadId === coveredId),
      ),
    [allRows, row.coveredThreadIds],
  );
  const checkScript = useMemo(
    () => selectResolveCheckScript({ groups: scriptGroups }),
    [scriptGroups],
  );
  const sharedMembers = useMemo(
    () => sharedCandidateThreadIds({ queueItemId: row.item.id, candidates, rows: allRows }),
    [allRows, candidates, row.item.id],
  );
  const sharedBlocker = useMemo(
    () => sharedCandidateBlocker({ members: sharedMembers }),
    [sharedMembers],
  );
  const hasSiblingDraft = sharedMembers.some((member) => {
    const draftReply = itemDrafts[member.threadId]?.reply ?? null;
    const storedReply =
      allRows.find((item) => item.thread.threadId === member.threadId)?.thread.replyDraft ?? null;
    return draftReply !== null && draftReply !== storedReply;
  });
  const proposalKind = candidate === null ? row.proposalKind : 'fix';
  const isApprovable = proposalKind !== 'none' || reply.trim() !== '';
  const costUsd =
    row.attempt === null
      ? null
      : (metrics.aggregatesByAgentId.get(row.attempt.agentId)?.estimatedCostUsd ?? null);

  const guard = async ({ run, onSuccess }: GuardParams): Promise<void> => {
    setIsBusy(true);
    setError(null);
    try {
      await run();
      if (isStillSelected()) {
        onSuccess?.();
      }
    } catch (caught) {
      if (isStillSelected()) {
        setError(formatError(caught));
      }
    } finally {
      if (isStillSelected()) {
        setIsBusy(false);
      }
    }
  };

  const onApprove = (): void => {
    void guard({
      run: () =>
        acceptResolveQueueItem({
          sessionId,
          itemId: row.item.id,
          revision: row.thread.revision,
          reply,
        }),
      onSuccess: () => {
        if (nextThreadId !== undefined) {
          onSelect(nextThreadId);
          return;
        }
        const excluded = sharedMembers.map((member) => member.threadId);
        if (excluded.length === 0) {
          onSelect(null);
          return;
        }
        onSelect(null, excluded);
      },
    });
  };
  const onRefuse = (): void => {
    void guard({
      run: () =>
        refuseResolveQueueItem({
          sessionId,
          itemId: row.item.id,
          revision: row.thread.revision,
          reply,
        }),
      onSuccess: () => {
        setMode('read');
        onSelect(null);
      },
    });
  };
  const onReopen = (): void => {
    void guard({
      run: () =>
        reopenResolveQueueItem({ sessionId, itemId: row.item.id, revision: row.thread.revision }),
    });
  };
  const onRunCheck = (): void => {
    if (candidate === null || checkScript === null || worktreePath === null) {
      return;
    }
    setIsCheckRunning(true);
    setError(null);
    setUnprovable(null);
    void runResolveCheck({
      sessionId,
      candidateId: candidate.id,
      command: checkScript.command,
      name: checkScript.name,
      testIdentity: null,
      breadth: 'full',
    })
      .then((pair) => isStillSelected() && setUnprovable(pair.unprovable))
      .catch((caught: unknown) => isStillSelected() && setError(formatError(caught)))
      .finally(() => isStillSelected() && setIsCheckRunning(false));
  };

  const actions = resolveItemActions({
    status: row.status,
    proposalKind,
    sharedApprovalCount: sharedMembers.length + 1,
    approveBlockedReason: hasSiblingDraft
      ? 'Finish or revert the edited reply on every shared comment before approving'
      : approveBlockedReasonFor({ row, isApprovable, sharedBlocker }),
    refuseBlockedReason: refuseBlockedReason({ row }),
    hasAgent: row.attempt !== null,
    hasGithubUrl: row.commentThread?.head.url != null,
    canStopRun: row.attempt?.phase === 'running',
    isEditing: mode !== 'read',
    isBusy,
  });
  const onAction = (id: ResolveItemActionId): void => {
    if (id === 'approve') {
      onApprove();
      return;
    }
    if (
      id === 'request_revision' ||
      id === 'answer_agent' ||
      id === 'start_agent' ||
      id === 'retry_agent' ||
      id === 'restart_agent'
    ) {
      setMode(attemptModeFor({ id }));
      return;
    }
    if (id === 'write_reply') {
      setMode('edit_reply');
      return;
    }
    if (id === 'will_not_fix') {
      setMode('refuse');
      return;
    }
    if (id === 'resume_comment' || id === 'change_decision') {
      void guard({ run: () => takeUpResolveQueueItem({ sessionId, itemId: row.item.id }) });
      return;
    }
    if (id === 'review_changed') {
      onReopen();
      return;
    }
    if (id === 'reopen_locally') {
      onReopen();
      return;
    }
    if (id === 'review_publication' || id === 'check_publication') {
      onReviewPublication({ threadId, reconcile: id === 'check_publication' });
      return;
    }
    if (id === 'open_github') {
      const url = row.commentThread?.head.url ?? null;
      if (url !== null) {
        void openUrl(url);
      }
      return;
    }
    if (id === 'view_agent' && row.attempt !== null) {
      void selectAgent(sessionId, row.attempt.agentId);
      return;
    }
    if (id === 'stop_run' && row.attempt !== null) {
      void forceCloseResolver(sessionId, row.attempt.agentId);
    }
  };

  return (
    <ResolveItemView
      row={row}
      prNumber={prNumber}
      coveredRows={coveredRows}
      files={diff.files}
      isDiffLoading={diff.isLoading}
      diffError={diff.error}
      checks={checks}
      costUsd={costUsd}
      candidateSha={candidate?.candidateSha ?? null}
      reply={reply}
      instruction={instruction}
      mode={mode}
      isBusy={isBusy}
      proposalKind={proposalKind}
      actions={actions}
      sharedMembers={sharedMembers}
      canRunCheck={candidate !== null && checkScript !== null}
      isCheckRunning={isCheckRunning}
      checksNote={unprovable}
      error={error}
      onChangeReply={setReply}
      onChangeInstruction={setInstruction}
      onEditReply={() => setMode('edit_reply')}
      onAction={onAction}
      onCancelRefuse={() => setMode('read')}
      onRefuse={onRefuse}
      onCancelRevise={() => setMode('read')}
      onSendToAgent={() => {
        const params = { threadId, instruction: instruction.trim() };
        const request =
          onRequestAttempt === undefined
            ? Promise.resolve(onAskForChanges?.(params) ?? false)
            : onRequestAttempt(params);
        void request.then((isSent) => {
          if (!isSent) {
            setError(COULD_NOT_SEND);
            return;
          }
          setInstruction('');
          setMode('read');
        });
      }}
      onBack={onBack}
      onPrevious={onPrevious}
      onNext={onNext}
      canPrevious={canPrevious}
      canNext={canNext}
      onOpenInDiff={() => {
        if (candidate !== null) {
          onOpenInDiff({
            threadId,
            sha: candidateHeadSha({ candidate }),
            path: row.reviewerNote?.path ?? null,
            line: row.reviewerNote?.line ?? null,
          });
        }
      }}
      onOpenCommit={({ sha }) =>
        onOpenInDiff({
          threadId,
          sha,
          path: row.reviewerNote?.path ?? null,
          line: row.reviewerNote?.line ?? null,
        })
      }
      onRunCheck={onRunCheck}
      onStopRun={() =>
        row.attempt !== null && void forceCloseResolver(sessionId, row.attempt.agentId)
      }
      onViewWork={() => row.attempt !== null && void selectAgent(sessionId, row.attempt.agentId)}
      onSelectRelated={(relatedThreadId) => onSelect(relatedThreadId)}
      onOpenUrl={(url) => void openUrl(url)}
    />
  );
};
