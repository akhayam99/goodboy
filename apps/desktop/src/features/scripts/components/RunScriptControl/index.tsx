import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@goodboy/ui';
import type { WorkspaceId, WorkspaceScript } from '@goodboy/types';
import { ChevronDown, ChevronUp, Loader2, Play, Terminal } from 'lucide-react';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore } from '../../../../store';
import type { ScriptRunResult, ScriptRunStatus } from '../../scripts';

interface RunScriptControlProps {
  readonly workspaceId: WorkspaceId;
}

interface PopoverAnchor {
  readonly left: number;
  readonly top: number;
}

interface RunState {
  readonly status: ScriptRunStatus;
  readonly result: ScriptRunResult | null;
}

const IDLE: RunState = { status: 'idle', result: null };

export function RunScriptControl({ workspaceId }: RunScriptControlProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const scripts = useAppStore((s) => s.workspaceScripts[workspaceId]);
  const loadScripts = useAppStore((s) => s.loadScripts);
  const runScript = useAppStore((s) => s.runScript);

  const [runState, setRunState] = useState<Record<string, RunState>>({});

  useEffect(() => {
    void loadScripts(workspaceId);
  }, [workspaceId, loadScripts]);

  const computeAnchor = useCallback((): PopoverAnchor | null => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { left: rect.left, top: rect.bottom + 4 };
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
            style={{ position: 'fixed', left: anchor.left, top: anchor.top }}
            className="z-50 max-h-[60vh] w-96 overflow-y-auto rounded-md bg-elevated py-1.5 text-xs shadow-lg ring-1 ring-border-soft"
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
                {list.map((script) => {
                  const run = runState[script.id] ?? IDLE;
                  return (
                    <li key={script.id}>
                      <ScriptRow script={script} run={run} onRun={() => void onRun(script)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        title="run workspace script"
        aria-label="run workspace script"
        aria-haspopup="menu"
        aria-expanded={open}
        className="shrink-0 rounded p-1 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
      >
        <Terminal size={13} aria-hidden />
      </button>
      {menu}
    </>
  );
}

interface ScriptRowProps {
  readonly script: WorkspaceScript;
  readonly run: RunState;
  readonly onRun: () => void;
}

function ScriptRow({ script, run, onRun }: ScriptRowProps) {
  const isPending = run.status === 'pending';
  const preview = script.body.trim().split('\n')[0] ?? '';
  return (
    <div className="rounded">
      <button
        type="button"
        role="menuitem"
        onClick={onRun}
        disabled={isPending}
        className={cn(
          'group flex w-full items-center gap-2.5 rounded px-2 py-2 text-left transition-colors',
          'hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        <StatusDot status={run.status} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium text-foreground">{script.name}</span>
          <span className="truncate font-mono text-2xs text-muted-foreground/80">{preview}</span>
        </div>
        {isPending ? (
          <Loader2 size={13} className="shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Play
            size={13}
            aria-hidden
            className="shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary"
          />
        )}
      </button>
      {run.result ? <ScriptOutput result={run.result} scriptId={script.id} /> : null}
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
  return <span className="size-2 shrink-0 rounded-full bg-border" aria-hidden />;
}

function ScriptOutput({ result, scriptId }: { result: ScriptRunResult; scriptId: string }) {
  const [open, setOpen] = useState(result.exitCode !== 0);
  return (
    <div className="mx-2 mb-1.5">
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
