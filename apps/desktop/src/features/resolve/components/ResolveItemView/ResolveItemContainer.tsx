import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { ResolveCheckRun, ResolveQueueItemWithThread, SessionId } from '@goodboy/types';
import { sessionPlace, useAppStore } from '../../../../store';
import { openUrl } from '../../../../shared/lib/editor';
import { useAgentMetrics } from '../../../session/hooks/useAgentMetrics';
import type { ScriptGroup } from '../../../scripts/scripts';
import { acceptedItemIds } from '../../acceptedItemIds';
import { summariseResolveChecks } from '../../checkReceipts';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';
import { useResolveCandidateDiff } from '../../hooks/useResolveCandidateDiff';
import { useResolveItemDraft } from '../../hooks/useResolveItemDraft';
import { refuseBlockedReason } from '../../refuseBlockedReason';
import { RESOLVE_ITEM_LABEL } from '../../resolveItemCopy';
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
import type { PanelPosition } from '../ResolvePanelHeader';
import type { ConversationTab } from '../../../../store/slices/drawer/state';

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
  readonly position?: PanelPosition | null;
  readonly tab?: ConversationTab;
  readonly onTabChange?: (tab: ConversationTab) => void;
  readonly agentPanel?: ReactNode;
  readonly onOpenAgentPage?: (() => void) | null;
  readonly onViewAgent?: () => void;
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
type ResolveBlockerParams = {
  readonly row: ResolveQueueRow;
  readonly isApprovable: boolean;
  readonly sharedBlocker: 'deferred' | 'wont_fix' | null;
};

const isSettled = ({ row }: { readonly row: ResolveQueueRow }): boolean =>
  row.status === 'approved' || (row.status === 'failed' && row.rowState.failedStep !== 'run');

const resolveBlockedReasonFor = ({
  row,
  isApprovable,
  sharedBlocker,
}: ResolveBlockerParams): string | null => {
  if (isSettled({ row })) {
    return null;
  }
  if (sharedBlocker === 'deferred') {
    return PARTIAL_ACCEPTANCE;
  }
  if (sharedBlocker === 'wont_fix') {
    return PARTIAL_REFUSAL;
  }
  if (!isApprovable) {
    return 'There is no fix or reply to send';
  }
  return row.status === 'ready' && row.proposalKind !== 'none'
    ? null
    : 'This comment is not ready to resolve';
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
  position = null,
  tab = 'comment',
  onTabChange = () => undefined,
  agentPanel = null,
  onOpenAgentPage = null,
  onViewAgent = () => undefined,
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
  const navigate = useAppStore((s) => s.navigate);
  const refuseResolveQueueItem = useAppStore((s) => s.refuseResolveQueueItem);
  const discussResolveThread = useAppStore((s) => s.discussResolveThread);
  const publishResolveThread = useAppStore((s) => s.publishResolveThread);
  const takeUpResolveQueueItem = useAppStore((s) => s.takeUpResolveQueueItem);
  const reopenResolveQueueItem = useAppStore((s) => s.reopenResolveQueueItem);
  const runResolveCheck = useAppStore((s) => s.runResolveCheck);
  const forceCloseResolver = useAppStore((s) => s.forceCloseResolver);
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
  const onResolve = (): void => {
    void guard({
      run: async () => {
        const decision = { sessionId, itemId: row.item.id, revision: row.thread.revision, reply };
        const isRewritten = reply !== (row.thread.replyDraft ?? '');
        if (row.item.approvalState === 'wont_fix') {
          if (isRewritten) {
            await refuseResolveQueueItem(decision);
          }
        } else if (row.item.approvalState !== 'accepted' || isRewritten) {
          await acceptResolveQueueItem(decision);
        }
        await publishResolveThread({ sessionId, threadId });
      },
      onSuccess: () => {
        setMode('read');
        if (nextThreadId !== undefined) {
          onSelect(nextThreadId);
          return;
        }
        const excluded = sharedMembers.map((member) => member.threadId);
        onSelect(null, excluded.length === 0 ? undefined : excluded);
      },
    });
  };
  const onDiscuss = (): void => {
    void guard({
      run: () => discussResolveThread({ sessionId, threadId, reply }),
      onSuccess: () => {
        setReply('');
        setMode('read');
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
    proposalKind: row.proposalKind,
    failedStep: row.rowState.failedStep,
    sharedApprovalCount: sharedMembers.length + 1,
    hasQuestion: row.status === 'needs_you',
    resolveBlockedReason: hasSiblingDraft
      ? 'Finish or revert the edited reply on every shared comment before resolving'
      : resolveBlockedReasonFor({ row, isApprovable, sharedBlocker }),
    closeBlockedReason: refuseBlockedReason({ row }),
    hasAgent: row.attempt !== null,
    hasGithubUrl: row.commentThread?.head.url != null,
    canStopRun: row.attempt?.phase === 'running',
    isEditing: mode !== 'read',
    isBusy,
  });
  const onSendToAgent = (): void => {
    const typed = instruction.trim();
    const params = {
      threadId,
      instruction: typed === '' ? RESOLVE_ITEM_LABEL.rereadInstruction : typed,
    };
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
  };

  const onCommitEditing = (): void => {
    if (mode === 'fix') {
      onSendToAgent();
      return;
    }
    if (mode === 'discuss') {
      onDiscuss();
      return;
    }
    if (mode === 'close') {
      onRefuse();
      return;
    }
    if (mode === 'resolve') {
      onResolve();
      return;
    }
    setMode('read');
  };

  const onAction = (id: ResolveItemActionId): void => {
    if (id === 'fix_it') {
      setMode('fix');
      return;
    }
    if (id === 'discuss') {
      setMode('discuss');
      return;
    }
    if (id === 'close') {
      setMode('close');
      return;
    }
    if (id === 'resolve') {
      setMode('resolve');
      return;
    }
    if (id === 'resume_comment' || id === 'change_decision') {
      void guard({ run: () => takeUpResolveQueueItem({ sessionId, itemId: row.item.id }) });
      return;
    }
    if (id === 'review_changed' || id === 'reopen_locally') {
      onReopen();
      return;
    }
    if (id === 'check_publication') {
      onReviewPublication({ threadId, reconcile: true });
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
      onViewAgent();
      return;
    }
    if (id === 'stop_run' && row.attempt !== null) {
      void forceCloseResolver(sessionId, row.attempt.agentId);
    }
  };

  return (
    <ResolveItemView
      sessionId={sessionId}
      row={row}
      position={position}
      tab={tab}
      onTabChange={onTabChange}
      agentPanel={agentPanel}
      onOpenAgentPage={onOpenAgentPage}
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
      onCancelEditing={() => setMode('read')}
      onCommitEditing={onCommitEditing}
      onBack={onBack}
      onOpenLocation={(path) =>
        navigate({
          to: sessionPlace({
            sessionId,
            lens: 'files',
            target: { kind: 'diff', mountPath: null, focus: { kind: 'branch', path } },
          }),
        })
      }
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
      onViewWork={onViewAgent}
      onSelectRelated={(relatedThreadId) => onSelect(relatedThreadId)}
      onOpenUrl={(url) => void openUrl(url)}
    />
  );
};
