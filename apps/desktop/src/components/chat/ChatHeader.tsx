import { useState } from 'react';
import { GitBranch, Square, ShieldCheck } from 'lucide-react';
import { Button, cn } from '@kay-am/ui';
import type { PhaseRun, PhaseRunStatus, ProviderRunId, Session, SessionId } from '@kay-am/types';
import { EMPTY_ARRAY, useAppStore } from '../../store';
import { OpenInEditorButton } from '../OpenInEditorButton';
import { PermissionAuditPanel } from './PermissionAuditPanel';
import { ParallelProgressPill } from './ParallelProgressPill';

interface ChatHeaderProps {
  session: Session;
  worktreePath: string | null;
  onEndSession: () => void;
  parallelRunIds?: ReadonlyArray<ProviderRunId>;
  onSelectRun?: (runId: ProviderRunId) => void;
}

function inferBranch(worktreePath: string | null, sessionId: string): string {
  if (!worktreePath) return sessionId.slice(0, 8);
  const tail = worktreePath.split('/').filter(Boolean).at(-1);
  return tail ?? sessionId.slice(0, 8);
}

export function ChatHeader({
  session,
  worktreePath,
  onEndSession,
  parallelRunIds,
  onSelectRun,
}: ChatHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const branch = inferBranch(worktreePath, session.id);
  const isEnded = session.state.kind === 'ended';

  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);

  const runStatuses = Object.fromEntries(
    (parallelRunIds ?? []).map((rid) => {
      const run = phaseRuns.find((r) => r.runId === rid);
      return [rid, run?.status ?? ('pending' as PhaseRunStatus)];
    }),
  ) as Readonly<Record<ProviderRunId, PhaseRunStatus>>;

  const isParallel = (parallelRunIds?.length ?? 0) > 1;

  const onCopyWorktree = async () => {
    try {
      await navigator.clipboard.writeText(branch);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard denied — silent
    }
  };

  return (
    <div className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-sm font-semibold tracking-tight">{session.goal}</h1>
          {isParallel && onSelectRun ? (
            <ParallelProgressPill
              parallelRunIds={parallelRunIds!}
              runStatuses={runStatuses}
              onSelectRun={onSelectRun}
            />
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <button
            type="button"
            onClick={() => void onCopyWorktree()}
            className="inline-flex items-center gap-1 rounded-sm px-1 -mx-1 hover:bg-muted hover:text-foreground"
            aria-label={`worktree — branch: ${branch}`}
            title={`worktree — branch: ${branch}`}
          >
            <GitBranch size={12} aria-hidden />
            <span className="font-mono">{branch}</span>
            {copied ? <span className="text-success">copied</span> : null}
          </button>
          {session.phaseTemplateId ? <PhaseProgressPill sessionId={session.id} /> : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <OpenInEditorButton worktreePath={worktreePath} />
        {!isEnded ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEndSession}
            title="end session — removes worktree, preserves branch"
          >
            <Square size={12} aria-hidden /> end session
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAuditOpen((v) => !v)}
          title="permission audit log"
          aria-label="permission audit log"
        >
          <ShieldCheck size={14} aria-hidden />
        </Button>
      </div>

      <PermissionAuditPanel
        sessionId={session.id}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
      />
    </div>
  );
}

const STATUS_DOT: Record<PhaseRunStatus, string> = {
  pending: 'bg-muted-foreground/40',
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-muted-foreground/20',
};

function PhaseProgressPill({ sessionId }: { sessionId: SessionId }) {
  const runs = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);

  if (runs.length === 0) return null;

  const sorted = runs.slice().sort((a, b) => a.ordinal - b.ordinal);
  const activeIdx = sorted.findIndex((r) => r.status === 'running');
  const lastCompletedIdx = sorted.reduce(
    (acc: number, r: PhaseRun, i: number) => (r.status === 'completed' ? i : acc),
    -1,
  );
  const displayIdx = activeIdx >= 0 ? activeIdx : lastCompletedIdx;
  const current = displayIdx >= 0 ? sorted[displayIdx] : sorted[0];

  if (!current) return null;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-subtle px-2 py-0.5 text-[10px] text-muted-foreground">
      <span className="font-mono">
        {displayIdx + 1}/{sorted.length} · {current.name}
      </span>
      <span className="flex items-center gap-0.5">
        {sorted.map((r) => (
          <span
            key={r.id}
            className={cn('inline-block h-1.5 w-1.5 rounded-full', STATUS_DOT[r.status])}
          />
        ))}
      </span>
    </div>
  );
}
