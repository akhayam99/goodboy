import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn, Divider, Popover } from '@goodboy/ui';
import type { SessionId, WorkspaceId, WorkspaceScript, WorkspaceScriptId } from '@goodboy/types';
import { Play, ScrollText, Square, Terminal } from 'lucide-react';
import { useAppStore } from '../../../../store';
import type { ScriptRunRecord, ScriptRunStatus } from '../../scripts';

// TODO (@ak): split file
interface RunScriptControlProps {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly worktreePath: string | null;
}

interface PopoverAnchor {
  readonly centerX: number;
  readonly top: number;
}

export function RunScriptControl({ sessionId, workspaceId, worktreePath }: RunScriptControlProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const scripts = useAppStore((s) => s.workspaceScripts[workspaceId]);
  const runs = useAppStore((s) => s.scriptRuns[sessionId]);
  const loadScripts = useAppStore((s) => s.loadScripts);
  const runScript = useAppStore((s) => s.runScript);
  const cancelScript = useAppStore((s) => s.cancelScript);

  const isRunning = runs ? Object.values(runs).some((r) => r.status === 'pending') : false;

  useEffect(() => {
    void loadScripts(workspaceId);
  }, [workspaceId, loadScripts]);

  const computeAnchor = useCallback((): PopoverAnchor | null => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { centerX: rect.left + rect.width / 2, top: rect.bottom + 4 };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onReanchor = () => {
      const next = computeAnchor();
      if (next) setAnchor(next);
      else setOpen(false);
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('resize', onReanchor);
    window.addEventListener('scroll', onReanchor, true);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('resize', onReanchor);
      window.removeEventListener('scroll', onReanchor, true);
    };
  }, [open, computeAnchor]);

  const onToggle = () => {
    if (!open) {
      const next = computeAnchor();
      if (next) setAnchor(next);
    }
    setOpen((v) => !v);
  };

  const onRun = useCallback(
    (script: WorkspaceScript) => {
      if (!worktreePath) return;
      void runScript(sessionId, script.id, worktreePath);
    },
    [runScript, sessionId, worktreePath],
  );

  const onCancel = useCallback(
    (scriptId: WorkspaceScriptId) => {
      void cancelScript(sessionId, scriptId);
    },
    [cancelScript, sessionId],
  );

  const list = scripts ?? [];

  const menu =
    open && anchor
      ? createPortal(
          <Popover
            innerRef={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              left: anchor.centerX,
              top: anchor.top,
              transform: 'translateX(-50%)',
            }}
            className="z-50 max-h-[60vh] w-96 overflow-y-auto py-1.5"
          >
            <div className="px-3 pb-1.5 pt-1 text-2xs uppercase tracking-wide text-muted-foreground/70">
              scripts
            </div>
            {list.length === 0 ? (
              <p className="px-3 py-3 text-2xs text-muted-foreground">
                No scripts. Add them in workspace settings.
              </p>
            ) : (
              <ul className="flex flex-col px-1.5">
                {list.map((script, i) => (
                  <Fragment key={script.id}>
                    {i > 0 ? (
                      <li aria-hidden className="px-1.5">
                        <Divider />
                      </li>
                    ) : null}
                    <li>
                      <ScriptRow
                        script={script}
                        run={runs?.[script.id] ?? null}
                        onRun={() => onRun(script)}
                        onCancel={() => onCancel(script.id)}
                      />
                    </li>
                  </Fragment>
                ))}
              </ul>
            )}
          </Popover>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        disabled={!worktreePath}
        title={worktreePath ? 'run workspace script' : 'session has no worktree yet'}
        aria-label="run workspace script"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'shrink-0 rounded p-1 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground/60',
          // Animated primary ring while any script in this session runs, the
          // signal survives the popover being closed.
          isRunning && 'spin-border spin-border-primary',
        )}
      >
        <Terminal size={13} aria-hidden />
      </button>
      {menu}
    </>
  );
}

// TODO (@ak): split file
interface ScriptRowProps {
  readonly script: WorkspaceScript;
  readonly run: ScriptRunRecord | null;
  readonly onRun: () => void;
  readonly onCancel: () => void;
}

function ScriptRow({ script, run, onRun, onCancel }: ScriptRowProps) {
  const status: ScriptRunStatus = run?.status ?? 'idle';
  const result = run?.result ?? null;
  const isPending = status === 'pending';
  const preview = script.body.trim().split('\n')[0] ?? '';
  const hasOutput = result !== null;
  // Default the disclosure open on a failed run, the user almost always
  // wants to see why it failed. Successful and cancelled runs stay collapsed.
  const [outputOpen, setOutputOpen] = useState(false);
  const prevResultRef = useRef(result);
  if (result !== prevResultRef.current) {
    prevResultRef.current = result;
    setOutputOpen(result !== null && result.exitCode !== 0 && status !== 'cancelled');
  }

  return (
    <div
      className={cn(
        'group flex flex-col rounded border border-transparent transition-colors',
        !isPending && 'hover:bg-muted/60',
        // Same border-spinner language used on running agents / workflow
        // steps: the row itself is the activity signal, no extra spinner
        // icon needed and the play affordance is locked while it runs.
        isPending && 'spin-border spin-border-info',
      )}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <StatusDot status={status} />
        <button
          type="button"
          role="menuitem"
          onClick={onRun}
          disabled={isPending}
          className="flex min-w-0 flex-1 flex-col gap-0.5 text-left disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="truncate font-medium text-foreground">{script.name}</span>
          <span className="truncate font-mono text-2xs text-muted-foreground/80">{preview}</span>
        </button>
        {hasOutput ? (
          <button
            type="button"
            onClick={() => setOutputOpen((v) => !v)}
            aria-expanded={outputOpen}
            aria-pressed={outputOpen}
            aria-controls={`script-out-${script.id}`}
            title={outputOpen ? 'hide output' : 'show output'}
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded transition-colors',
              outputOpen
                ? 'bg-primary/15 text-primary ring-1 ring-primary/30 ring-inset'
                : 'text-muted-foreground/60 hover:bg-foreground/10 hover:text-foreground',
            )}
          >
            <ScrollText size={13} aria-hidden />
          </button>
        ) : null}
        {isPending ? (
          <button
            type="button"
            onClick={onCancel}
            title="stop script"
            aria-label="stop script"
            className="flex size-6 shrink-0 items-center justify-center rounded text-danger transition-colors hover:bg-danger/10"
          >
            <Square size={11} fill="currentColor" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={onRun}
            title="run script"
            aria-label="run script"
            className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-foreground/10 hover:text-primary group-hover:text-muted-foreground"
          >
            <Play size={13} aria-hidden />
          </button>
        )}
      </div>
      {hasOutput && outputOpen ? (
        <pre
          id={`script-out-${script.id}`}
          className="mx-2 mb-2 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-background px-2 py-1.5 font-mono text-2xs leading-relaxed text-foreground/80"
        >
          <span className="block text-muted-foreground/70">exit {result!.exitCode}</span>
          {result!.stdout}
          {result!.stderr ? (
            <span className="text-danger">
              {result!.stdout ? '\n' : ''}
              {result!.stderr}
            </span>
          ) : null}
          {!result!.stdout && !result!.stderr ? '(no output)' : null}
        </pre>
      ) : null}
    </div>
  );
}

function StatusDot({ status }: { status: ScriptRunStatus }) {
  if (status === 'ok') {
    return (
      <span
        className="size-2 shrink-0 rounded-full bg-success"
        aria-label="last run ok"
        role="img"
      />
    );
  }
  if (status === 'error') {
    return (
      <span
        className="size-2 shrink-0 rounded-full bg-danger"
        aria-label="last run failed"
        role="img"
      />
    );
  }
  if (status === 'cancelled') {
    return (
      <span
        className="size-2 shrink-0 rounded-full bg-muted-foreground/50"
        aria-label="last run cancelled"
        role="img"
      />
    );
  }
  return <span className="size-2 shrink-0 rounded-full bg-border" aria-hidden />;
}
