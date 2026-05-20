import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@kay-am/ui';
import type { WorkspaceId, WorkspaceScript } from '@kay-am/types';
import { Check, ChevronDown, ChevronUp, Code2, Loader2, Play, Terminal, X } from 'lucide-react';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore } from '../../../../store';
import type { ScriptRunResult, ScriptRunStatus } from '../../scripts';

interface RunScriptControlProps {
  readonly workspaceId: WorkspaceId;
}

interface PopoverAnchor {
  readonly left: number;
  readonly top: number | null;
  readonly bottom: number | null;
  readonly direction: 'up' | 'down';
}

interface RunState {
  readonly status: ScriptRunStatus;
  readonly result: ScriptRunResult | null;
}

const IDLE: RunState = { status: 'idle', result: null };

/**
 * Session-level entry point for workspace scripts. Mirrors `SpawnAgentControl`:
 * a trigger that opens a right-anchored popover, flipped up or down to stay on
 * screen. Run-only — script CRUD lives in workspace settings.
 */
export function RunScriptControl({ workspaceId }: RunScriptControlProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const scripts = useAppStore((s) => s.workspaceScripts[workspaceId]);
  const loadScripts = useAppStore((s) => s.loadScripts);
  const runScript = useAppStore((s) => s.runScript);

  const [runState, setRunState] = useState<Record<string, RunState>>({});
  const [codeOpen, setCodeOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void loadScripts(workspaceId);
  }, [workspaceId, loadScripts]);

  const computeAnchor = useCallback((): PopoverAnchor | null => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const direction: 'up' | 'down' = spaceBelow > spaceAbove ? 'down' : 'up';
    const left = rect.right + 4;
    if (direction === 'down') {
      return { left, top: rect.top, bottom: null, direction };
    }
    return { left, top: null, bottom: window.innerHeight - rect.bottom, direction };
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
    async (script: WorkspaceScript) => {
      setRunState((prev) => ({ ...prev, [script.id]: { status: 'pending', result: null } }));
      try {
        const result = await runScript(script.id);
        setRunState((prev) => ({
          ...prev,
          [script.id]: { status: result.exitCode === 0 ? 'ok' : 'error', result },
        }));
      } catch (err) {
        setRunState((prev) => ({
          ...prev,
          [script.id]: {
            status: 'error',
            result: { stdout: '', stderr: formatError(err), exitCode: -1 },
          },
        }));
      }
    },
    [runScript],
  );

  const list = scripts ?? [];

  const menu =
    open && anchor
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              left: anchor.left,
              ...(anchor.top !== null ? { top: anchor.top } : {}),
              ...(anchor.bottom !== null ? { bottom: anchor.bottom } : {}),
            }}
            className="z-50 max-h-[60vh] w-80 overflow-y-auto rounded bg-subtle py-1 text-xs shadow-lg ring-1 ring-border-soft"
          >
            <div className="px-2.5 pb-1 pt-1.5 text-2xs uppercase tracking-wide text-muted-foreground/70">
              workspace scripts
            </div>
            {list.length === 0 ? (
              <p className="px-2.5 py-3 text-2xs text-muted-foreground">
                No scripts. Add them in workspace settings.
              </p>
            ) : (
              list.map((script) => {
                const run = runState[script.id] ?? IDLE;
                const showCode = codeOpen[script.id] ?? false;
                return (
                  <div key={script.id}>
                    <div className="flex items-center gap-2 px-2.5 py-1.5">
                      <StatusDot status={run.status} />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void onRun(script)}
                        disabled={run.status === 'pending'}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Play size={11} aria-hidden className="shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium text-foreground">{script.name}</span>
                      </button>
                      <button
                        type="button"
                        aria-label="show script code"
                        title="show code"
                        onClick={() => setCodeOpen((prev) => ({ ...prev, [script.id]: !showCode }))}
                        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Code2 size={12} aria-hidden />
                      </button>
                    </div>
                    {showCode ? (
                      <pre className="mx-2.5 mb-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-background px-2 py-1.5 font-mono text-2xs leading-relaxed text-foreground/80">
                        {script.body}
                      </pre>
                    ) : null}
                    {run.result ? <ScriptOutput result={run.result} scriptId={script.id} /> : null}
                  </div>
                );
              })
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative mt-1">
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded border border-dashed border-border-soft px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Terminal size={13} aria-hidden />
        Run script
      </button>
      {menu}
    </div>
  );
}

function StatusDot({ status }: { status: ScriptRunStatus }) {
  if (status === 'pending') {
    return (
      <Loader2 size={12} className="shrink-0 animate-spin text-muted-foreground" aria-hidden />
    );
  }
  if (status === 'ok') {
    return <Check size={12} className="shrink-0 text-success" aria-label="last run ok" />;
  }
  if (status === 'error') {
    return <X size={12} className="shrink-0 text-danger" aria-label="last run failed" />;
  }
  return <span className="size-1.5 shrink-0 rounded-full bg-border" aria-hidden />;
}

function ScriptOutput({ result, scriptId }: { result: ScriptRunResult; scriptId: string }) {
  const [open, setOpen] = useState(result.exitCode !== 0);
  return (
    <div className="mx-2.5 mb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-controls={`script-out-${scriptId}`}
        className="flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronUp size={10} aria-hidden /> : <ChevronDown size={10} aria-hidden />}
        output · exit {result.exitCode}
      </button>
      {open ? (
        <pre
          id={`script-out-${scriptId}`}
          className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-background px-2 py-1.5 font-mono text-2xs leading-relaxed text-foreground/80"
        >
          {result.stdout}
          {result.stderr ? (
            <span className="text-danger">
              {result.stdout ? '\n' : ''}
              {result.stderr}
            </span>
          ) : null}
          {!result.stdout && !result.stderr ? '(no output)' : null}
        </pre>
      ) : null}
    </div>
  );
}
