import { useState } from 'react';
import { GitBranch, FolderOpen, Cpu, PanelRightClose, PanelRightOpen, Square } from 'lucide-react';
import { Button, cn } from '@kay-am/ui';
import type { PhaseRun, PhaseRunStatus, ProviderId, Session, SessionId } from '@kay-am/types';
import { getDefaultTurnModel } from '@kay-am/core';
import { openInEditor } from '../../editor';
import { DEFAULT_EDITOR_BINARY, SETTING_EDITOR_BINARY } from '../../settings';
import { useAppStore } from '../../store';

interface ChatHeaderProps {
  session: Session;
  worktreePath: string | null;
  contextOpen: boolean;
  onToggleContext: () => void;
  onEndSession: () => void;
}

const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: 'claude',
  cursor: 'cursor',
  codex: 'codex',
};

function inferBranch(worktreePath: string | null, sessionId: string): string {
  if (!worktreePath) return sessionId.slice(0, 8);
  const tail = worktreePath.split('/').filter(Boolean).at(-1);
  return tail ?? sessionId.slice(0, 8);
}

export function ChatHeader({
  session,
  worktreePath,
  contextOpen,
  onToggleContext,
  onEndSession,
}: ChatHeaderProps) {
  const editorBinary = useAppStore(
    (s) => s.settings[SETTING_EDITOR_BINARY] ?? DEFAULT_EDITOR_BINARY,
  );
  const [copied, setCopied] = useState(false);
  const [openErr, setOpenErr] = useState<string | null>(null);

  const provider = session.providerPreference.defaultProvider;
  const model = session.providerPreference.defaultModel ?? getDefaultTurnModel(provider);
  const branch = inferBranch(worktreePath, session.id);
  const isEnded = session.state.kind === 'ended';

  const onCopyBranch = async () => {
    try {
      await navigator.clipboard.writeText(branch);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard denied — silent
    }
  };

  const onOpenWorktree = async () => {
    if (!worktreePath) return;
    setOpenErr(null);
    try {
      await openInEditor(worktreePath, editorBinary);
    } catch (err) {
      setOpenErr(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold tracking-tight">{session.goal}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <button
            type="button"
            onClick={() => void onCopyBranch()}
            className="inline-flex items-center gap-1 rounded-sm px-1 -mx-1 hover:bg-muted hover:text-foreground"
            title="copy branch name"
          >
            <GitBranch size={12} aria-hidden />
            <span className="font-mono">{branch}</span>
            {copied ? <span className="text-success">copied</span> : null}
          </button>
          <button
            type="button"
            onClick={() => void onOpenWorktree()}
            disabled={!worktreePath}
            className={cn(
              'inline-flex items-center gap-1 rounded-sm px-1 -mx-1 hover:bg-muted hover:text-foreground',
              !worktreePath && 'opacity-50 hover:bg-transparent hover:text-muted-foreground',
            )}
            title={
              worktreePath ? `open ${worktreePath} in ${editorBinary}` : 'no worktree available'
            }
          >
            <FolderOpen size={12} aria-hidden />
            <span className="font-mono">
              {worktreePath ? truncatePath(worktreePath) : 'no worktree'}
            </span>
          </button>
          <span className="inline-flex items-center gap-1">
            <Cpu size={12} aria-hidden />
            <span className="font-mono">
              {PROVIDER_LABEL[provider]} · {model}
            </span>
          </span>
          {openErr ? <span className="text-danger">{openErr}</span> : null}
          {session.phaseTemplateId ? <PhaseProgressPill sessionId={session.id} /> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
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
          onClick={onToggleContext}
          title={contextOpen ? 'hide context panel' : 'show context panel'}
          aria-label={contextOpen ? 'hide context panel' : 'show context panel'}
        >
          {contextOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
        </Button>
      </div>
    </div>
  );
}

function truncatePath(p: string, max = 48): string {
  if (p.length <= max) return p;
  return `…${p.slice(-(max - 1))}`;
}

const STATUS_DOT: Record<PhaseRunStatus, string> = {
  pending: 'bg-muted-foreground/40',
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-muted-foreground/20',
};

function PhaseProgressPill({ sessionId }: { sessionId: SessionId }) {
  const runs = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? []);

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
