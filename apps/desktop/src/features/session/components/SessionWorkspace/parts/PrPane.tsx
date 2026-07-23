import { useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  GitBranch,
  GitFork,
  GitMerge,
  GitPullRequest,
  MessageSquare,
  RefreshCw,
  Sparkles,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Eyebrow, cn } from '@goodboy/ui';
import type { PrCheckRun, PullRequestStateKind, Session, SessionId } from '@goodboy/types';
import { PullRequestChip, pullRequestMeta } from '../../../../github/components/PullRequestChip';
import { GitlabMrStrip } from '../../../../context/components/ContextPanel/strips/GitlabMrStrip';
import { useRemoteHostKind } from '../../../../worktree/useRemoteHostKind';
import { appendOperatorNotes } from '../../../utils/appendOperatorNotes';
import { AgentSpawnConfig } from '../../AgentSpawnConfig';
import type { AgentSpawnConfigValue } from '../../AgentSpawnConfig/AgentSpawnConfigValue';
import { taskModelAgentSpawnConfig } from '../../AgentSpawnConfig/taskModelAgentSpawnConfig';
import { useAppStore } from '../../../../../store';
import { PaneShell } from './PaneShell';
import { PrListRow } from './PrListRow';

type Props = {
  readonly session: Session;
};

type PullRequestProvider = 'github' | 'gitlab';

export const PrPane = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const remoteKind = useRemoteHostKind(session.workspaceId);
  const pullRequest = useAppStore((state) => state.sessionGithub[sessionId]?.pr ?? null);
  const mergeRequest = useAppStore((state) => state.sessionGitlabMr[sessionId]?.mr ?? null);
  const [selectedProvider, setSelectedProvider] = useState<PullRequestProvider | null>(null);
  const defaultProvider: PullRequestProvider =
    remoteKind === 'gitlab' && mergeRequest != null
      ? 'gitlab'
      : pullRequest != null
        ? 'github'
        : mergeRequest != null
          ? 'gitlab'
          : remoteKind === 'gitlab'
            ? 'gitlab'
            : 'github';
  const activeProvider = selectedProvider ?? defaultProvider;
  const mergeRequestState: PullRequestStateKind | null =
    mergeRequest == null
      ? null
      : mergeRequest.draft
        ? 'draft'
        : mergeRequest.state === 'merged'
          ? 'merged'
          : mergeRequest.state === 'closed'
            ? 'closed'
            : 'open';
  const hasPullRequests = pullRequest != null || mergeRequest != null;

  return (
    <PaneShell title="Pull requests" description="Review status for this session.">
      <div className="flex flex-col gap-3">
        {hasPullRequests ? (
          <div className="flex flex-col gap-1.5">
            <Eyebrow label="Pull requests" muted className="px-0.5 font-medium" />
            <div className="flex flex-col gap-1">
              {pullRequest != null ? (
                <PrListRow
                  provider="GitHub"
                  icon={GitFork}
                  identifier={`#${pullRequest.number}`}
                  title={pullRequest.title}
                  state={pullRequestMeta(pullRequest.state).label}
                  isSelected={activeProvider === 'github'}
                  onClick={() => setSelectedProvider('github')}
                />
              ) : null}
              {mergeRequest != null && mergeRequestState != null ? (
                <PrListRow
                  provider="GitLab"
                  icon={GitMerge}
                  identifier={`!${mergeRequest.iid}`}
                  title={mergeRequest.title}
                  state={pullRequestMeta(mergeRequestState).label}
                  isSelected={activeProvider === 'gitlab'}
                  onClick={() => setSelectedProvider('gitlab')}
                />
              ) : null}
            </div>
          </div>
        ) : null}
        {activeProvider === 'gitlab' ? (
          <GitlabMrStrip sessionId={sessionId} />
        ) : (
          <GithubPrCard session={session} />
        )}
      </div>
    </PaneShell>
  );
};

const GithubPrCard = ({ session }: { session: Session }) => {
  const sessionId = session.id as SessionId;
  const github = useAppStore((s) => s.sessionGithub[sessionId]);
  const refreshSessionPr = useAppStore((s) => s.refreshSessionPr);
  const createPrForSession = useAppStore((s) => s.createPrForSession);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const branch = useAppStore((s) => s.sessionBranches[sessionId] ?? null);
  const workspaceOverrides = useAppStore(
    (s) => s.workspaceOverrides?.[session.workspaceId] ?? null,
  );
  const pr = github?.pr ?? null;
  const detail = github?.detail ?? null;
  const loading = github?.loading ?? false;
  const error = github?.error ?? null;

  const [busy, setBusy] = useState<'draft' | 'ai' | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [agentConfig, setAgentConfig] = useState<AgentSpawnConfigValue>(() =>
    taskModelAgentSpawnConfig({
      preferences: workspaceOverrides?.taskModels,
      defaultProviderId: session.providerPreference.defaultProvider,
    }),
  );

  const openStudio = () =>
    window.dispatchEvent(new CustomEvent('goodboy:open-github-session', { detail: { sessionId } }));
  const refresh = () => void refreshSessionPr(sessionId, { force: true });

  const createQuickDraft = async () => {
    if (busy) return;
    setBusy('draft');
    setCreateError(null);
    try {
      await createPrForSession(sessionId, { draft: true });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const draftWithAgent = async () => {
    if (busy) return;
    setBusy('ai');
    setCreateError(null);
    try {
      const prompt = [
        `Open a draft GitHub pull request for this session's branch.`,
        `- Write a clear, conventional title and a concise, well-structured description from the committed changes.`,
        `- Session goal: "${session.goal}".`,
        `- If this project defines a PR-creation skill, command, or template (look under .claude/), follow it.`,
        `Then run \`gh pr create --draft\` to open it and report the PR URL.`,
      ].join('\n');
      const agentId = await spawnAgent(sessionId, {
        name: 'open pull request',
        initialPrompt: appendOperatorNotes({ prompt, hint: agentConfig.hint }),
        model: agentConfig.model,
        ...(agentConfig.provider !== '' && { provider: agentConfig.provider }),
        effort: agentConfig.effort,
      });
      setActiveLens(sessionId, 'agents');
      await selectAgent(sessionId, agentId);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  };

  if (!pr) {
    return (
      <div className="animate-fade-in relative flex flex-col items-center gap-5 rounded-lg border border-dashed border-border-soft bg-elevated/40 px-8 py-8 text-center">
        <div className="absolute right-3 top-3">
          <RefreshButton onClick={refresh} loading={loading} error={error} />
        </div>
        <span
          aria-hidden
          className="flex size-12 items-center justify-center rounded-full bg-primary/10"
        >
          <GitPullRequest size={24} className="text-primary" />
        </span>
        <div className="flex flex-col items-center gap-1.5">
          <h2 className="text-base font-semibold text-foreground">Open a pull request</h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Turn this session&rsquo;s work into a draft PR. Let an agent write the title and
            description from your commits, or open one instantly.
          </p>
          {branch ? (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-2.5 py-1 font-mono text-2xs text-muted-foreground ring-1 ring-border-soft/60">
              <GitBranch size={11} aria-hidden className="shrink-0" />
              <span className="truncate text-foreground/80">{branch}</span>
            </span>
          ) : null}
        </div>
        <AgentSpawnConfig
          value={agentConfig}
          onChange={setAgentConfig}
          disabled={busy !== null}
          className="w-full max-w-sm"
        />
        <div className="flex flex-col items-stretch gap-2 pt-1 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void draftWithAgent()}
            disabled={busy !== null}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50',
              busy === 'ai' && 'animate-border-pulse',
            )}
          >
            <Sparkles size={14} aria-hidden className="shrink-0" />
            Draft with an agent
          </button>
          <button
            type="button"
            onClick={() => void createQuickDraft()}
            disabled={busy !== null}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent bg-foreground/[0.04] px-4 py-2 text-xs font-medium text-foreground ring-1 ring-border-soft transition-colors hover:bg-foreground/[0.08] disabled:opacity-50',
              busy === 'draft' && 'animate-border-pulse',
            )}
          >
            <GitPullRequest size={14} aria-hidden className="shrink-0 opacity-70" />
            Quick draft
          </button>
          <button
            type="button"
            onClick={openStudio}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Open PR studio
            <ArrowUpRight size={13} aria-hidden className="shrink-0 opacity-70" />
          </button>
        </div>
        {createError ? (
          <span className="text-2xs text-danger" title={createError}>
            {createError}
          </span>
        ) : null}
      </div>
    );
  }

  const ciState = computeCiState(detail?.checks ?? []);
  const unresolved = (detail?.comments ?? []).filter(
    (c) => c.source === 'review' && c.resolved === false,
  ).length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-elevated px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <PullRequestChip state={pr.state} variant="badge" number={pr.number} iconSize={12} />
            {ciState !== 'none' ? <CiBadge state={ciState} /> : null}
          </div>
          <h2 className="text-balance text-sm font-semibold leading-snug text-foreground">
            {pr.title}
          </h2>
        </div>
        <RefreshButton onClick={refresh} loading={loading} error={error} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1">
          <GitBranch size={11} aria-hidden className="shrink-0" />
          <span className="truncate font-medium text-foreground/80">{pr.headBranch}</span>
          <span className="text-muted-foreground/50">→</span>
          <span className="truncate">{pr.baseBranch}</span>
        </span>
        {pr.reviewDecision ? <ReviewBadge decision={pr.reviewDecision} /> : null}
        {unresolved > 0 ? (
          <span className="inline-flex items-center gap-1">
            <MessageSquare size={11} aria-hidden />
            <span className="tabular-nums">{unresolved}</span>
            <span>unresolved</span>
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={openStudio}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-foreground/[0.04] px-3 py-2 text-xs font-medium text-foreground ring-1 ring-border-soft transition-colors hover:bg-foreground/[0.08]"
      >
        Open PR
        <ArrowUpRight size={13} aria-hidden className="shrink-0 opacity-70" />
      </button>

      {error ? (
        <span className="text-2xs text-danger" title={error}>
          {error}
        </span>
      ) : null}
    </div>
  );
};

const RefreshButton = ({
  onClick,
  loading,
  error,
}: {
  onClick: () => void;
  loading: boolean;
  error: string | null;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    title={error ? `refresh failed: ${error}` : 'refresh PR status'}
    aria-label="refresh PR status"
    className={cn(
      'flex size-7 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground ring-1 ring-border-soft/40 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50',
      loading && 'animate-border-pulse',
    )}
  >
    <RefreshCw size={12} aria-hidden />
  </button>
);

type CiState = 'success' | 'failure' | 'pending' | 'none';

const computeCiState = (checks: ReadonlyArray<PrCheckRun>): CiState => {
  if (checks.length === 0) return 'none';
  if (
    checks.some(
      (c) =>
        c.conclusion === 'failure' || c.conclusion === 'cancelled' || c.conclusion === 'timed_out',
    )
  ) {
    return 'failure';
  }
  if (checks.some((c) => c.conclusion === 'pending')) return 'pending';
  if (checks.some((c) => c.conclusion === 'success')) return 'success';
  return 'none';
};

const CiBadge = ({ state }: { state: CiState }) => {
  const map: Record<CiState, { icon: LucideIcon; className: string; label: string }> = {
    success: { icon: CheckCircle2, className: 'text-success', label: 'CI passing' },
    failure: { icon: XCircle, className: 'text-danger', label: 'CI failing' },
    pending: { icon: Clock, className: 'text-warning', label: 'CI running' },
    none: { icon: Clock, className: 'text-muted-foreground/40', label: 'no CI' },
  };
  const entry = map[state];
  const Icon = entry.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-2xs font-medium', entry.className)}>
      <Icon size={12} aria-hidden />
      {entry.label}
    </span>
  );
};

const ReviewBadge = ({
  decision,
}: {
  decision: 'approved' | 'changes_requested' | 'review_required';
}) => {
  const map = {
    approved: { className: 'text-success', label: 'Approved' },
    changes_requested: { className: 'text-warning', label: 'Changes requested' },
    review_required: { className: 'text-muted-foreground', label: 'Review required' },
  } as const;
  const entry = map[decision];
  return <span className={cn('font-medium', entry.className)}>{entry.label}</span>;
};
