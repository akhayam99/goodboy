import { useState } from 'react';
import {
  DollarSign,
  GitBranch,
  GitMerge,
  GitPullRequest,
  GitPullRequestArrow,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Loader2,
  Settings2,
  Users,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { cn } from '@kay-am/ui';
import type { PullRequestStateKind, Session, SessionId } from '@kay-am/types';
import { useAppStore } from '../../../../store';
import { StatusBadge } from '../../../session/components/StatusBadge';
import { SessionStatusMenu } from '../../../session/components/SessionStatusMenu';
import { openUrl } from '../../../../shared/lib/editor';
import { formatError } from '../../../../shared/lib/errors';

interface SessionDetailPanelProps {
  session: Session;
  onOpenSessionSettings: () => void;
}

export function SessionDetailPanel({ session, onOpenSessionSettings }: SessionDetailPanelProps) {
  const branch = useAppStore((s) => s.sessionBranches[session.id as SessionId]);
  const github = useAppStore((s) => s.sessionGithub[session.id as SessionId]);
  const spentUsd = useAppStore((s) => s.sessionSummary?.estimatedCostUsd ?? null);
  const agentCount = useAppStore((s) => {
    const runs = s.sessionPhaseRuns[session.id as SessionId] ?? [];
    return runs.filter((r) => !(r.stepId && r.status === 'pending')).length;
  });
  const workflowName = useAppStore((s) => {
    if (!session.workflowId) return null;
    const templates = s.phaseTemplates[session.workspaceId] ?? [];
    return templates.find((t) => t.id === session.workflowId)?.name ?? null;
  });
  const setSessionUserStatus = useAppStore((s) => s.setSessionUserStatus);
  const renameTask = useAppStore((s) => s.renameTask);

  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  const startRename = () => {
    setRenameDraft(session.goal);
    setRenameError(null);
    setRenaming(true);
  };

  const commitRename = async () => {
    if (!renameDraft.trim()) {
      setRenameError('name cannot be empty');
      return;
    }
    try {
      await renameTask(session.id as SessionId, renameDraft.trim());
      setRenaming(false);
      setRenameError(null);
    } catch (err) {
      setRenameError(formatError(err));
    }
  };

  const onRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void commitRename();
    if (e.key === 'Escape') {
      setRenaming(false);
      setRenameError(null);
    }
  };

  const pr = github?.pr ?? null;
  const prLoading = !github || github.loading || (github.fetchedAt === null && !github.error);

  return (
    <div className="flex shrink-0 flex-col border-b border-border-soft/50 px-3 py-3">
      {/* row 1: status + goal + badges */}
      <div className="flex items-start gap-2">
        <SessionStatusMenu
          status={session.userStatus}
          sessionLabel={session.goal}
          onPick={(next) => void setSessionUserStatus(session.id as SessionId, next)}
        />
        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="flex flex-col gap-0.5">
              <input
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={() => void commitRename()}
                onKeyDown={onRenameKeyDown}
                className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
              />
              {renameError && <span className="text-2xs text-danger">{renameError}</span>}
            </div>
          ) : (
            <span
              className="line-clamp-3 cursor-pointer text-xs font-semibold leading-relaxed text-foreground"
              onDoubleClick={startRename}
              title="double-click to rename"
            >
              {session.goal}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge state={session.state} />
          <button
            type="button"
            onClick={onOpenSessionSettings}
            className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
            title="session settings"
            aria-label="session settings"
          >
            <Settings2 size={12} aria-hidden />
          </button>
        </div>
      </div>

      {/* row 2: git info */}
      <div className="mt-3 flex flex-col gap-1.5">
        {branch && (
          <div className="flex items-center gap-1.5 text-2xs">
            <GitBranch size={11} aria-hidden className="shrink-0 text-muted-foreground/60" />
            <span className="truncate font-mono text-muted-foreground" title={branch}>
              {branch}
            </span>
            <PrStatusInline pr={pr} loading={prLoading} />
          </div>
        )}

        {/* row 3: stats grid */}
        <div className="flex items-center gap-3 text-2xs text-muted-foreground">
          {workflowName && (
            <span className="inline-flex items-center gap-1" title="workflow">
              <WorkflowIcon size={10} aria-hidden className="shrink-0 text-primary/70" />
              <span>{workflowName.toLowerCase()}</span>
            </span>
          )}
          <span
            className="inline-flex items-center gap-1"
            title={`${agentCount} agent${agentCount === 1 ? '' : 's'}`}
          >
            <Users size={10} aria-hidden className="text-muted-foreground/60" />
            <span className="tabular-nums">{agentCount}</span>
          </span>
          {spentUsd !== null && spentUsd > 0 && (
            <span
              className="inline-flex items-center gap-1"
              title={`$${spentUsd.toFixed(4)} total`}
            >
              <DollarSign size={10} aria-hidden className="text-muted-foreground/60" />
              <span className="tabular-nums">{spentUsd.toFixed(2)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const PR_ICON_MAP: Record<
  PullRequestStateKind,
  { icon: React.ElementType; label: string; className: string }
> = {
  draft: { icon: GitPullRequestDraft, label: 'draft', className: 'text-muted-foreground' },
  open: { icon: GitPullRequest, label: 'in review', className: 'text-success' },
  approved: { icon: GitPullRequestArrow, label: 'approved', className: 'text-success' },
  merged: { icon: GitMerge, label: 'merged', className: 'text-merged' },
  closed: { icon: GitPullRequestClosed, label: 'closed', className: 'text-danger' },
};

function PrStatusInline({
  pr,
  loading,
}: {
  pr: { number: number; state: PullRequestStateKind; url: string } | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground/50" title="loading PR…">
        <Loader2 size={10} aria-hidden className="animate-spin" />
      </span>
    );
  }
  if (!pr) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded bg-danger/10 px-1.5 py-0.5 text-danger/80"
        title="no PR open"
      >
        <GitPullRequest size={10} aria-hidden />
        <span>no PR</span>
      </span>
    );
  }
  const entry = PR_ICON_MAP[pr.state];
  if (!entry) return null;
  const Icon = entry.icon;
  return (
    <button
      type="button"
      onClick={() => void openUrl(pr.url)}
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-muted',
        entry.className,
      )}
      title={`PR #${pr.number} — ${entry.label}`}
    >
      <Icon size={10} aria-hidden />
      <span>
        #{pr.number} {entry.label}
      </span>
    </button>
  );
}
