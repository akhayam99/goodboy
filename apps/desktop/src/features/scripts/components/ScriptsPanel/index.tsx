import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button, Input, Textarea, cn } from '@goodboy/ui';
import type { WorkspaceId, WorkspaceScript, WorkspaceScriptId } from '@goodboy/types';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore } from '../../../../store';
import type { ScriptRunResult, ScriptRunStatus } from '../../scripts';

interface ScriptsPanelProps {
  readonly workspaceId: WorkspaceId;
}

interface RunState {
  readonly status: ScriptRunStatus;
  readonly result: ScriptRunResult | null;
  readonly outputOpen: boolean;
}

const IDLE_RUN: RunState = { status: 'idle', result: null, outputOpen: false };

type Draft = { id: WorkspaceScriptId | null; name: string; body: string };

export function ScriptsPanel({ workspaceId }: ScriptsPanelProps) {
  const scripts = useAppStore((s) => s.workspaceScripts[workspaceId]);
  const loadScripts = useAppStore((s) => s.loadScripts);
  const saveScript = useAppStore((s) => s.saveScript);
  const deleteScript = useAppStore((s) => s.deleteScript);
  const runScript = useAppStore((s) => s.runScript);

  const [runState, setRunState] = useState<Record<string, RunState>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadScripts(workspaceId);
  }, [workspaceId, loadScripts]);

  const patchRun = useCallback((id: string, next: Partial<RunState>) => {
    setRunState((prev) => ({ ...prev, [id]: { ...(prev[id] ?? IDLE_RUN), ...next } }));
  }, []);

  const onRun = useCallback(
    async (script: WorkspaceScript) => {
      patchRun(script.id, { status: 'pending', result: null });
      try {
        const result = await runScript(script.id);
        patchRun(script.id, {
          status: result.exitCode === 0 ? 'ok' : 'error',
          result,
          outputOpen: result.exitCode !== 0,
        });
      } catch (err) {
        patchRun(script.id, {
          status: 'error',
          result: { stdout: '', stderr: formatError(err), exitCode: -1 },
          outputOpen: true,
        });
      }
    },
    [patchRun, runScript],
  );

  const onCopy = useCallback((body: string) => {
    void navigator.clipboard.writeText(body).catch(() => undefined);
  }, []);

  const onSaveDraft = useCallback(async () => {
    if (!draft) return;
    const name = draft.name.trim();
    const body = draft.body.trim();
    if (!name || !body) {
      setError('name and script body are required');
      return;
    }
    setError(null);
    try {
      await saveScript({ workspaceId, id: draft.id ?? undefined, name, body });
      setDraft(null);
    } catch (err) {
      setError(formatError(err));
    }
  }, [draft, saveScript, workspaceId]);

  const onDelete = useCallback(
    async (id: WorkspaceScriptId) => {
      try {
        await deleteScript(id, workspaceId);
      } catch (err) {
        setError(formatError(err));
      }
    },
    [deleteScript, workspaceId],
  );

  const list = scripts ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Shell scripts you run by hand. cwd is the workspace root.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDraft({ id: null, name: '', body: '' })}
          disabled={draft !== null}
        >
          <Plus size={13} aria-hidden />
          New script
        </Button>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {list.length === 0 && draft === null ? (
        <p className="rounded-md border border-dashed border-border-soft px-3 py-6 text-center text-xs text-muted-foreground">
          No scripts yet. Create one — e.g. <code className="font-mono">copy environments</code>.
        </p>
      ) : null}

      <ul className="flex flex-col gap-1.5">
        {list.map((script) => {
          const run = runState[script.id] ?? IDLE_RUN;
          const isEditing = draft?.id === script.id;
          if (isEditing && draft) {
            return (
              <li key={script.id}>
                <ScriptEditor
                  draft={draft}
                  setDraft={setDraft}
                  onSave={() => void onSaveDraft()}
                  onCancel={() => {
                    setDraft(null);
                    setError(null);
                  }}
                />
              </li>
            );
          }
          return (
            <li key={script.id} className="rounded-md border border-border-soft bg-background">
              <div className="flex items-center gap-2 px-2.5 py-2">
                <StatusDot status={run.status} />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {script.name}
                </span>
                <RowAction
                  icon={
                    run.status === 'pending' ? (
                      <Loader2 size={13} className="animate-spin" aria-hidden />
                    ) : (
                      <Play size={13} aria-hidden />
                    )
                  }
                  label="run script"
                  disabled={run.status === 'pending' || draft !== null}
                  onClick={() => void onRun(script)}
                />
                <RowAction
                  icon={<Copy size={13} aria-hidden />}
                  label="copy script"
                  onClick={() => onCopy(script.body)}
                />
                <RowAction
                  icon={<Pencil size={13} aria-hidden />}
                  label="edit script"
                  disabled={draft !== null}
                  onClick={() => setDraft({ id: script.id, name: script.name, body: script.body })}
                />
                <RowAction
                  icon={<Trash2 size={13} aria-hidden />}
                  label="delete script"
                  tone="danger"
                  disabled={draft !== null}
                  onClick={() => void onDelete(script.id)}
                />
              </div>
              {run.result ? (
                <div className="border-t border-border-soft">
                  <button
                    type="button"
                    onClick={() => patchRun(script.id, { outputOpen: !run.outputOpen })}
                    className="flex w-full items-center gap-1.5 px-2.5 py-1 text-2xs text-muted-foreground hover:text-foreground"
                  >
                    {run.outputOpen ? (
                      <ChevronUp size={11} aria-hidden />
                    ) : (
                      <ChevronDown size={11} aria-hidden />
                    )}
                    output · exit {run.result.exitCode}
                  </button>
                  {run.outputOpen ? (
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all border-t border-border-soft bg-subtle px-2.5 py-2 font-mono text-2xs leading-relaxed text-foreground/80">
                      {run.result.stdout}
                      {run.result.stderr ? (
                        <span className="text-danger">
                          {run.result.stdout ? '\n' : ''}
                          {run.result.stderr}
                        </span>
                      ) : null}
                      {!run.result.stdout && !run.result.stderr ? '(no output)' : null}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}

        {draft && draft.id === null ? (
          <li>
            <ScriptEditor
              draft={draft}
              setDraft={setDraft}
              onSave={() => void onSaveDraft()}
              onCancel={() => {
                setDraft(null);
                setError(null);
              }}
            />
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function StatusDot({ status }: { status: ScriptRunStatus }) {
  if (status === 'pending') {
    return (
      <Loader2 size={13} className="shrink-0 animate-spin text-muted-foreground" aria-hidden />
    );
  }
  if (status === 'ok') {
    return <Check size={13} className="shrink-0 text-success" aria-label="last run ok" />;
  }
  if (status === 'error') {
    return <X size={13} className="shrink-0 text-danger" aria-label="last run failed" />;
  }
  return <span className="size-[7px] shrink-0 rounded-full bg-border" aria-hidden />;
}

function RowAction({
  icon,
  label,
  onClick,
  disabled,
  tone,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-6 items-center justify-center rounded text-muted-foreground transition-colors',
        'hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40',
        tone === 'danger' && 'hover:bg-danger/10 hover:text-danger',
      )}
    >
      {icon}
    </button>
  );
}

function ScriptEditor({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-primary/40 bg-subtle/50 p-2.5">
      <Input
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder="script name — e.g. copy environments"
        autoFocus
      />
      <Textarea
        value={draft.body}
        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        placeholder={'#!/bin/bash\ncp ../main/.env .env'}
        className="min-h-[120px] resize-y font-mono text-xs"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        rows={6}
      />
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave}>
          <Check size={13} aria-hidden />
          Save
        </Button>
      </div>
    </div>
  );
}
