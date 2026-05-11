import { useState } from 'react';
import { GitBranch, MessagesSquare } from 'lucide-react';
import { cn } from '@kay-am/ui';
import type { Session, SessionStatus, ProviderRunId, Task, TaskId } from '@kay-am/types';
import { EMPTY_ARRAY, useAppStore } from '../../store';
import { OpenInEditorButton } from '../OpenInEditorButton';
import { ParallelProgressPill } from './ParallelProgressPill';
import { permissionModeMeta } from './PermissionModePicker';

interface ChatHeaderProps {
  session: Task;
  worktreePath: string | null;
  parallelRunIds?: ReadonlyArray<ProviderRunId>;
  onSelectRun?: (runId: ProviderRunId) => void;
}

function inferBranch(worktreePath: string | null, taskId: string): string {
  if (!worktreePath) return taskId.slice(0, 8);
  const tail = worktreePath.split('/').filter(Boolean).at(-1);
  return tail ?? taskId.slice(0, 8);
}

export function ChatHeader({
  session,
  worktreePath,
  parallelRunIds,
  onSelectRun,
}: ChatHeaderProps) {
  const [copied, setCopied] = useState(false);

  const branch = inferBranch(worktreePath, session.id);
  const mode = permissionModeMeta(session.permissionMode);

  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
  const events = useAppStore((s) => {
    const agentId = s.selectedAgentId[session.id] ?? null;
    return agentId ? (s.transcripts[agentId] ?? EMPTY_ARRAY) : EMPTY_ARRAY;
  });
  const userTurns = events.filter((e) => e.kind === 'user_text').length;
  const assistantReplies = events.filter((e) => e.kind === 'done').length;

  const runStatuses = Object.fromEntries(
    (parallelRunIds ?? []).map((rid) => {
      const run = phaseRuns.find((r) => r.runId === rid);
      return [rid, run?.status ?? ('pending' as SessionStatus)];
    }),
  ) as Readonly<Record<ProviderRunId, SessionStatus>>;

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
    <div className="px-10 py-2.5">
      <div className="mx-auto flex w-full max-w-[880px] items-center gap-3">
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
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
            <span
              className="inline-flex items-center gap-1"
              title={`${userTurns} message${userTurns === 1 ? '' : 's'} sent · ${assistantReplies} reply${assistantReplies === 1 ? '' : 'ies'}`}
            >
              <MessagesSquare size={12} aria-hidden />
              <span className="font-mono text-foreground/85">{userTurns}</span>
              <span>turn{userTurns === 1 ? '' : 's'}</span>
              {assistantReplies > 0 ? (
                <span className="text-muted-foreground/60">· {assistantReplies} replies</span>
              ) : null}
            </span>
            <span
              className="inline-flex items-center gap-1 text-2xs text-muted-foreground"
              title={mode.description}
              aria-label={`permission mode: ${mode.label}`}
            >
              <span aria-hidden className={cn('inline-block h-1.5 w-1.5 rounded-full', mode.dot)} />
              <span>{mode.label}</span>
            </span>
            {session.workflowId ? <PhaseProgressPill taskId={session.id} /> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <OpenInEditorButton worktreePath={worktreePath} />
        </div>
      </div>
    </div>
  );
}

const STATUS_DOT: Record<SessionStatus, string> = {
  pending: 'bg-muted-foreground/40',
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-muted-foreground/20',
};

function PhaseProgressPill({ taskId }: { taskId: TaskId }) {
  const runs = useAppStore((s) => s.sessionPhaseRuns[taskId] ?? EMPTY_ARRAY);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[taskId] ?? null);

  if (runs.length === 0) return null;

  const sorted = runs.slice().sort((a, b) => a.ordinal - b.ordinal);
  const selectedIdx = selectedAgentId ? sorted.findIndex((r) => r.id === selectedAgentId) : -1;
  const activeIdx = sorted.findIndex((r) => r.status === 'running');
  const lastCompletedIdx = sorted.reduce(
    (acc: number, r: Session, i: number) => (r.status === 'completed' ? i : acc),
    -1,
  );
  // Selected agent takes priority — pill reflects the agent the user is
  // looking at, not workflow-wide running state. Falls back to running, then
  // last completed when no agent is selected (e.g. fresh task).
  const displayIdx = selectedIdx >= 0 ? selectedIdx : activeIdx >= 0 ? activeIdx : lastCompletedIdx;
  const current = displayIdx >= 0 ? sorted[displayIdx] : sorted[0];

  if (!current) return null;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-subtle px-2 py-0.5 text-2xs text-muted-foreground">
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
