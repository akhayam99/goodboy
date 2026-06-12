import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Check,
  FolderOpen,
  GitBranch,
  Settings2,
  Trash2,
} from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Session, SessionId, TelemetryRecord } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { SessionStageBadge } from '../../../session/components/SessionStageBadge';
import { openInEditor } from '../../../../shared/lib/editor';
import { OverflowMenu, type OverflowMenuItem } from '../../../../shared/components/OverflowMenu';
import { formatError } from '../../../../shared/lib/errors';
import { useToast } from '../../../../app/components/Toast';

type SessionDetailPanelProps = {
  session: Session;
  onOpenSessionSettings: () => void;
};

export const SessionDetailPanel = ({ session, onOpenSessionSettings }: SessionDetailPanelProps) => {
  const worktreePath = useAppStore((s) => s.sessionWorktrees[session.id as SessionId]?.[0] ?? null);
  const renameTask = useAppStore((s) => s.renameTask);
  const externalTask = useAppStore(
    (s) => s.sessionExternalTasks?.[session.id as SessionId] ?? null,
  );
  const detectedEditors = useAppStore((s) => s.detectedEditors);
  const loadDetectedEditors = useAppStore((s) => s.loadDetectedEditors);
  const { showToast } = useToast();

  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  useEffect(() => {
    if (detectedEditors.length === 0) {
      void loadDetectedEditors();
    }
  }, []);

  const launchEditor = async (binary: string) => {
    if (!worktreePath) {
      return;
    }
    try {
      await openInEditor(worktreePath, binary);
    } catch (err) {
      showToast('error', `couldn't open editor: ${formatError(err)}`);
    }
  };

  const actionItems = useMemo<ReadonlyArray<OverflowMenuItem>>(() => {
    const items: OverflowMenuItem[] = [];

    if (detectedEditors.length === 0) {
      items.push({
        kind: 'item',
        key: 'no-editor',
        label: 'No editor detected',
        icon: FolderOpen,
        onClick: () => undefined,
        disabled: true,
      });
    } else {
      items.push({ kind: 'header', key: 'editor-header', label: 'Open in editor' });
      for (const ed of detectedEditors) {
        items.push({
          kind: 'item',
          key: `editor-${ed.binary}`,
          label: ed.label,
          icon: FolderOpen,
          onClick: () => void launchEditor(ed.binary),
          disabled: !worktreePath,
        });
      }
    }

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedEditors, worktreePath]);

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
    if (e.key === 'Enter') {
      void commitRename();
    }
    if (e.key === 'Escape') {
      setRenaming(false);
      setRenameError(null);
    }
  };

  return (
    <div className="flex shrink-0 flex-col gap-2 px-2 pb-2 pt-2.5">
      <div className="flex items-center gap-2">
        <SessionStageBadge session={session} />
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
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('goodboy:open-linear-studio', {
                  detail: { issueExternalId: externalTask.externalId },
                }),
              )
            }
            title={`${externalTask.identifier}: ${externalTask.title}`}
            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-provider-linear/30 bg-provider-linear/5 px-1.5 py-0.5 text-2xs font-medium text-provider-linear transition-colors hover:border-provider-linear/60 hover:bg-provider-linear/10"
            aria-label={`open ${externalTask.identifier} in linear studio`}
          >
            <span className="font-mono">{externalTask.identifier}</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenSessionSettings}
          title="Session settings"
          aria-label="session settings"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <Settings2 size={13} aria-hidden />
        </button>
        <OverflowMenu
          items={actionItems}
          label="open in editor"
          trigger={<FolderOpen size={13} aria-hidden />}
        />
      </div>
    </div>
  );
};

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
  const sessionCost = useMemo(() => {
    let sum = 0;
    for (const rec of telemetry) {
      if (rec.kind === 'summarizer') {
        continue;
      }
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

    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplayLabel(finalLabel);
      setAnimating(false);
      return;
    }

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
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent('goodboy:open-budget-studio', {
              detail: { scope: { kind: 'session', sessionId } },
            }),
          )
        }
        title={`Estimated cost for this session: ${finalLabel} (excluding summarizer), click for budget studio`}
        className={cn(
          'inline-flex shrink-0 items-center rounded-md border border-success/20 bg-success/10 px-2 py-1 font-mono text-2xs text-success transition-colors hover:border-success/40 hover:bg-success/15',
          animating && 'cost-chip-pulse',
        )}
      >
        {displayLabel}
      </button>
    </>
  );
}

type SessionMetaFooterProps = {
  session: Session;
};

export const SessionMetaFooter = ({ session }: SessionMetaFooterProps) => {
  const branch = useAppStore((s) => s.sessionBranches[session.id as SessionId] ?? null);
  const unarchiveTask = useAppStore((s) => s.unarchiveTask);
  const { showToast } = useToast();
  const archived = Boolean(session.archivedAt);

  const onToggleArchive = () => {
    if (archived) {
      unarchiveTask(session.id as SessionId).catch((err: unknown) => {
        showToast('error', `couldn't unarchive: ${formatError(err)}`);
      });
      return;
    }
    window.dispatchEvent(new CustomEvent('goodboy:archive-session'));
  };

  return (
    <div className="flex shrink-0 items-center gap-2 px-2 pb-2.5 pt-2">
      {branch ? (
        <div className="min-w-0 flex-1">
          <BranchChip branch={branch} />
        </div>
      ) : (
        <div className="flex-1" />
      )}
      <SessionCostChip sessionId={session.id as SessionId} />
      <button
        type="button"
        onClick={onToggleArchive}
        title={archived ? 'Unarchive session' : 'Archive session (⌘⇧A)'}
        aria-label={archived ? 'unarchive session' : 'archive session'}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        {archived ? <ArchiveRestore size={12} aria-hidden /> : <Archive size={12} aria-hidden />}
      </button>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('goodboy:delete-session'))}
        title="Delete session (⌘.)"
        aria-label="delete session"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 size={12} aria-hidden />
      </button>
    </div>
  );
};
