import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { PrComment, PrDetail, PullRequestState, SessionId } from '@goodboy/types';
import { Button, Divider, EmptyState } from '@goodboy/ui';
import { AlertCircle, GitPullRequest, Inbox, Loader2, Plus, RefreshCw } from 'lucide-react';
import {
  buildCommentAgentArgs,
  buildReviewChangesAgentArgs,
  type CommentAgentArgs,
} from '../../../chat/spawn-from-comment';
import { openUrl } from '../../../../shared/lib/editor';
import { ScrollFade } from '../../../../shared/components/ScrollFade';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore, useSessions } from '../../../../store';
import { ghPrDetailByNumber, ghPrsForBranch } from '../../github';
import { CreatePrDialog } from './CreatePrDialog';
import { PrActionBar, type ActionBusy } from './PrActionBar';
import { PrChecks } from './PrChecks';
import { PrConversation } from './PrConversation';
import { PrOverview } from './PrOverview';
import { PrSidebar, type PrSection } from './PrSidebar';

interface Props {
  readonly sessionId: SessionId | null;
  readonly onClose: () => void;
}

export function PrDetailPanel({ sessionId, onClose }: Props) {
  const sessions = useSessions();
  const session = sessionId ? sessions.find((s) => s.id === sessionId) : undefined;
  const github = useAppStore((s) => (sessionId ? s.sessionGithub[sessionId] : null));
  const branch = useAppStore((s) => (sessionId ? (s.sessionBranches[sessionId] ?? null) : null));
  const workspaceRoot = useAppStore((s) => {
    const sess = sessionId ? s.sessions.find((x) => x.id === sessionId) : undefined;
    const ws = sess ? s.workspaces.find((w) => w.id === sess.workspaceId) : undefined;
    return ws?.rootPath ?? null;
  });
  const workspaceId = session?.workspaceId;
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const markPrReady = useAppStore((s) => s.markPrReady);
  const convertPrToDraft = useAppStore((s) => s.convertPrToDraft);
  const mergePr = useAppStore((s) => s.mergePr);
  const closePr = useAppStore((s) => s.closePr);
  const reopenPr = useAppStore((s) => s.reopenPr);
  const requestReview = useAppStore((s) => s.requestReview);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);

  const [busy, setBusy] = useState<ActionBusy>(null);
  const [mergeConfirm, setMergeConfirm] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [section, setSection] = useState<PrSection>('overview');
  const [prs, setPrs] = useState<ReadonlyArray<PullRequestState>>([]);
  const [prsTick, setPrsTick] = useState(0);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [localDetail, setLocalDetail] = useState<PrDetail | null>(null);
  const [localDetailLoading, setLocalDetailLoading] = useState(false);
  const [localDetailError, setLocalDetailError] = useState<string | null>(null);

  const primary = github?.pr ?? null;
  const primaryNumber = primary?.number ?? null;
  const options = prs.length > 0 ? prs : primary ? [primary] : [];
  const selected = selectedNumber ?? primaryNumber ?? options[0]?.number ?? null;
  const activePr = options.find((p) => p.number === selected) ?? primary;
  const isPrimary = !!activePr && activePr.number === primaryNumber;

  const detail = isPrimary ? (github?.detail ?? null) : localDetail;
  const detailLoading = isPrimary ? !!github?.detailLoading : localDetailLoading;
  const detailError = isPrimary ? (github?.detailError ?? null) : localDetailError;

  const fetchLocalDetail = useCallback(
    async (num: number) => {
      if (!workspaceRoot) return;
      setLocalDetailLoading(true);
      setLocalDetailError(null);
      try {
        setLocalDetail(await ghPrDetailByNumber(workspaceRoot, num, workspaceId));
      } catch (e) {
        setLocalDetailError(formatError(e));
      } finally {
        setLocalDetailLoading(false);
      }
    },
    [workspaceRoot, workspaceId],
  );

  useEffect(() => {
    setSelectedNumber(null);
    setLocalDetail(null);
    setLocalDetailError(null);
    setMergeConfirm(false);
    setCreateOpen(false);
    setSection('overview');
  }, [sessionId]);

  useEffect(() => {
    if (!branch || !workspaceRoot) {
      setPrs([]);
      return;
    }
    let cancelled = false;
    void ghPrsForBranch(workspaceRoot, branch, workspaceId)
      .then((list) => {
        if (!cancelled) setPrs(list);
      })
      .catch(() => {
        if (!cancelled) setPrs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [branch, workspaceRoot, workspaceId, prsTick]);

  useEffect(() => {
    if (!sessionId || !isPrimary || !activePr) return;
    if (!github?.detail && !github?.detailLoading && !github?.detailError) {
      void refreshSessionPrDetail(sessionId);
    }
  }, [
    sessionId,
    isPrimary,
    activePr,
    github?.detail,
    github?.detailLoading,
    github?.detailError,
    refreshSessionPrDetail,
  ]);

  useEffect(() => {
    if (!activePr || isPrimary) return;
    void fetchLocalDetail(activePr.number);
  }, [activePr, isPrimary, fetchLocalDetail]);

  if (!sessionId || !session) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <EmptyState
          icon={Inbox}
          title="No session selected"
          description="Pick a session from the inbox to see its pull request."
        />
      </div>
    );
  }

  const refreshActive = () => {
    if (!activePr) return;
    if (isPrimary) void refreshSessionPrDetail(sessionId, { force: true });
    else void fetchLocalDetail(activePr.number);
  };

  const onMutated = () => {
    setPrsTick((t) => t + 1);
    refreshActive();
  };

  const runResolve = async (args: CommentAgentArgs) => {
    const agentId = await spawnAgent(sessionId, {
      name: args.name,
      model: args.model,
      effort: args.effort,
      initialPrompt: args.initialPrompt,
      kindOverride: args.kind,
    });
    await selectAgent(sessionId, agentId);
    await setCurrentSession(sessionId);
    onClose();
  };

  const onSpawnFromComment = (comment: PrComment) => {
    if (!activePr) return;
    void runResolve(buildCommentAgentArgs(comment, activePr));
  };

  const onSpawnFromReviewChanges = () => {
    if (!activePr) return;
    const open = (detail?.comments ?? []).filter(
      (c) => c.source === 'review' && c.resolved === false,
    );
    void runResolve(buildReviewChangesAgentArgs(activePr, open));
  };

  const run = async (kind: Exclude<ActionBusy, null>, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    try {
      await fn();
      onMutated();
    } catch {
      void 0;
    } finally {
      setBusy(null);
      setMergeConfirm(false);
    }
  };

  const onAddReviewers = (logins: ReadonlyArray<string>) => {
    if (!activePr) return;
    void (async () => {
      try {
        await requestReview(sessionId, activePr.number, logins);
      } catch {
        void 0;
      }
      onMutated();
    })();
  };

  if (!activePr) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <EmptyState
          icon={GitPullRequest}
          title="Ready to open a pull request"
          description="Write the title and description, or hand it to an agent."
          action={
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus size={14} aria-hidden />
                Create PR
              </Button>
              <OpenSessionButton sessionId={sessionId} onOpened={onClose} variant="secondary" />
            </div>
          }
        />
        {createOpen ? (
          <CreatePrDialog
            sessionId={sessionId}
            defaultTitle={session.goal}
            onClose={() => setCreateOpen(false)}
            onStudioClose={onClose}
          />
        ) : null}
      </div>
    );
  }

  const isTerminal = activePr.state === 'merged' || activePr.state === 'closed';
  const isClosed = activePr.state === 'closed';
  const isDraft = activePr.isDraft;
  const canMerge = !isTerminal && !isDraft && activePr.mergeable !== false;
  const mergeReason = isDraft
    ? 'mark the PR ready before merging'
    : activePr.mergeable === false
      ? 'PR has conflicts, resolve them first'
      : 'squash merge this PR';
  const num = activePr.number;

  return (
    <div className="flex h-full min-h-0">
      <PrSidebar
        pr={activePr}
        options={options}
        selected={selected}
        onSelectPr={setSelectedNumber}
        detail={detail}
        section={section}
        onSection={setSection}
        workspaceRoot={workspaceRoot}
        onAddReviewers={onAddReviewers}
      />

      <Divider orientation="vertical" />

      <div className="flex min-w-0 flex-1 flex-col">
        <PrActionBar
          pr={activePr}
          sessionId={sessionId}
          onOpenSession={onClose}
          busy={busy}
          detailLoading={detailLoading}
          mergeConfirm={mergeConfirm}
          canMerge={canMerge}
          mergeReason={mergeReason}
          onMarkReady={() => void run('ready', () => markPrReady(sessionId, num))}
          onConvertDraft={() => void run('undraft', () => convertPrToDraft(sessionId, num))}
          onClose={() => void run('close', () => closePr(sessionId, num))}
          onReopen={() => void run('reopen', () => reopenPr(sessionId, num))}
          onCreateNew={() => setCreateOpen(true)}
          onMerge={() => void run('merge', () => mergePr(sessionId, num))}
          onSetMergeConfirm={setMergeConfirm}
          onOpenGithub={() => void openUrl(activePr.url)}
          onRefresh={refreshActive}
        />

        <Divider />

        <ScrollFade className="min-h-0 flex-1">
          {section === 'overview' ? (
            <PrOverview pr={activePr} sessionId={sessionId} onMutated={onMutated} />
          ) : (
            <SectionBody
              detailLoading={detailLoading}
              detailError={detailError}
              detail={detail}
              onRetry={refreshActive}
            >
              {section === 'comments' ? (
                <PrConversation
                  comments={detail?.comments ?? []}
                  pr={activePr}
                  changesRequested={activePr.reviewDecision === 'changes_requested'}
                  onOpenUrl={(u) => void openUrl(u)}
                  onSpawnFromComment={onSpawnFromComment}
                  onSpawnFromReviewChanges={onSpawnFromReviewChanges}
                />
              ) : (
                <PrChecks
                  checks={detail?.checks ?? []}
                  pr={activePr}
                  onOpenUrl={(u) => void openUrl(u)}
                />
              )}
            </SectionBody>
          )}
        </ScrollFade>
      </div>

      {createOpen ? (
        <CreatePrDialog
          sessionId={sessionId}
          defaultTitle={session.goal}
          closedPr={isClosed ? { number: activePr.number, url: activePr.url } : undefined}
          onClose={() => setCreateOpen(false)}
          onStudioClose={onClose}
        />
      ) : null}
    </div>
  );
}

function SectionBody({
  detail,
  detailLoading,
  detailError,
  onRetry,
  children,
}: {
  detail: PrDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  onRetry: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-8 py-6">
      {detailError ? (
        <div className="flex items-center gap-1.5 text-xs text-danger">
          <AlertCircle size={13} aria-hidden />
          <span className="min-w-0 flex-1 truncate" title={detailError}>
            {detailError}
          </span>
          <button
            type="button"
            onClick={onRetry}
            aria-label="retry"
            className="rounded p-0.5 hover:bg-muted"
          >
            <RefreshCw size={12} aria-hidden />
          </button>
        </div>
      ) : detailLoading && !detail ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={13} aria-hidden className="animate-spin" />
          loading
        </div>
      ) : (
        children
      )}
    </div>
  );
}
