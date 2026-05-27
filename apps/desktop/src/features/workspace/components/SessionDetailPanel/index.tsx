import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, GitBranch, Settings2 } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Session, SessionId, TelemetryRecord } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { SessionStatusMenu } from '../../../session/components/SessionStatusMenu';
import { OpenInEditorIconButton } from '../../../session/components/OpenInEditorIconButton';
import { RunScriptControl } from '../../../scripts';
import { formatError } from '../../../../shared/lib/errors';
import { useToast } from '../../../../app/components/Toast';
import { PricingDialog } from '../../../providers/components/PricingDialog';

interface SessionDetailPanelProps {
  session: Session;
  onOpenSessionSettings: () => void;
}

export function SessionDetailPanel({ session, onOpenSessionSettings }: SessionDetailPanelProps) {
  const worktreePath = useAppStore((s) => s.sessionWorktrees[session.id as SessionId]?.[0] ?? null);
  const setSessionUserStatus = useAppStore((s) => s.setSessionUserStatus);
  const renameTask = useAppStore((s) => s.renameTask);
  const externalTask = useAppStore(
    (s) => s.sessionExternalTasks?.[session.id as SessionId] ?? null,
  );

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

  return (
    <div className="flex shrink-0 flex-col gap-2 px-3 pt-3 pb-2">
      {/* header row, user tick · title · settings */}
      <div className="flex items-center gap-2">
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
              className="line-clamp-2 cursor-pointer text-xs font-semibold leading-snug text-foreground"
              onDoubleClick={startRename}
              title="double-click to rename"
            >
              {session.goal}
            </span>
          )}
        </div>
        {externalTask ? (
          <a
            href={externalTask.url}
            target="_blank"
            rel="noreferrer"
            title={`${externalTask.identifier}: ${externalTask.title}`}
            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-[#5e6ad2]/30 bg-[#5e6ad2]/5 px-1.5 py-0.5 text-[10px] font-medium text-[#5e6ad2] transition-colors hover:border-[#5e6ad2]/60 hover:bg-[#5e6ad2]/10"
            aria-label={`open ${externalTask.identifier} in linear`}
          >
            <span className="font-mono">{externalTask.identifier}</span>
          </a>
        ) : null}
        <OpenInEditorIconButton worktreePath={worktreePath} />
        <RunScriptControl
          sessionId={session.id as SessionId}
          workspaceId={session.workspaceId}
          worktreePath={worktreePath}
        />
        <button
          type="button"
          onClick={onOpenSessionSettings}
          className="shrink-0 rounded p-1 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
          title="session settings"
          aria-label="session settings"
        >
          <Settings2 size={13} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function BranchChip({ branch }: { branch: string }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(branch);
      setCopied(true);
      showToast('success', 'branch copied');
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      showToast('error', `copy failed: ${formatError(err)}`);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      title="click to copy branch name"
      className={cn(
        'group inline-flex min-w-0 max-w-full shrink items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-2xs transition-colors',
        copied
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-border-soft bg-muted/30 text-foreground/80 hover:border-border hover:bg-muted/50 hover:text-foreground',
      )}
    >
      {copied ? (
        <Check size={10} aria-hidden className="shrink-0" />
      ) : (
        <GitBranch
          size={10}
          aria-hidden
          className="shrink-0 text-muted-foreground group-hover:text-foreground"
        />
      )}
      <span className="truncate">{branch}</span>
    </button>
  );
}

function SessionCostChip({ sessionId }: { sessionId: SessionId }) {
  const telemetry = useAppStore(
    (s) => s.sessionTelemetry[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const [pricingOpen, setPricingOpen] = useState(false);
  const sessionCost = useMemo(() => {
    let sum = 0;
    for (const rec of telemetry) {
      if (rec.kind === 'summarizer') continue;
      sum += rec.estimatedCostUsd;
    }
    return sum;
  }, [telemetry]);
  const finalLabel = sessionCost === 0 ? '$0' : `$${sessionCost.toFixed(2)}`;

  const [displayLabel, setDisplayLabel] = useState(finalLabel);
  const [animating, setAnimating] = useState(false);
  const prevCostRef = useRef(sessionCost);
  const prevSessionIdRef = useRef(sessionId);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Session switch, snap, don't animate stale → fresh transition.
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId;
      prevCostRef.current = sessionCost;
      setDisplayLabel(finalLabel);
      setAnimating(false);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    if (prevCostRef.current === sessionCost) {
      setDisplayLabel(finalLabel);
      return;
    }
    const fromCost = prevCostRef.current;
    const toCost = sessionCost;
    prevCostRef.current = toCost;

    // Respect reduced motion: snap to final, no roll, no glow.
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplayLabel(finalLabel);
      setAnimating(false);
      return;
    }

    // Interpolate the numeric value directly and re-format on every frame.
    // The previous slot-machine roller spun each digit through extra full
    // 0-9 cycles, so a small bump like $0.99 → $1.05 briefly painted
    // $9.XX mid-animation. Value-space interpolation can never show a
    // number outside [fromCost, toCost], so the chip reads as a real
    // counter regardless of direction.
    setAnimating(true);
    const duration = 1100;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = fromCost + (toCost - fromCost) * eased;
      setDisplayLabel(current === 0 ? '$0' : `$${current.toFixed(2)}`);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        setDisplayLabel(finalLabel);
        setAnimating(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [sessionCost, sessionId, finalLabel]);

  return (
    <>
      <button
        type="button"
        onClick={() => setPricingOpen(true)}
        title={`Estimated cost for this session: ${finalLabel} (excluding summarizer), click for spend breakdown`}
        className={cn(
          'inline-flex shrink-0 items-center rounded-md border border-success/20 bg-success/10 px-2 py-1 font-mono text-2xs text-success transition-colors hover:border-success/40 hover:bg-success/15',
          animating && 'cost-chip-pulse',
        )}
      >
        {displayLabel}
      </button>
      <PricingDialog open={pricingOpen} onClose={() => setPricingOpen(false)} />
    </>
  );
}

interface SessionMetaFooterProps {
  session: Session;
}

// Branch identity + session cost only. Files and GitHub moved to the
// right-hand ContextPanel tabs (plan §B), so the sidebar footer keeps just
// the at-a-glance identity bits and stops being a vertical stack.
export function SessionMetaFooter({ session }: SessionMetaFooterProps) {
  const branch = useAppStore((s) => s.sessionBranches[session.id as SessionId] ?? null);

  return (
    <div className="flex shrink-0 items-center gap-2 px-3 pb-3 pt-2">
      {branch ? (
        <div className="min-w-0 flex-1">
          <BranchChip branch={branch} />
        </div>
      ) : (
        <div className="flex-1" />
      )}
      <SessionCostChip sessionId={session.id as SessionId} />
    </div>
  );
}
