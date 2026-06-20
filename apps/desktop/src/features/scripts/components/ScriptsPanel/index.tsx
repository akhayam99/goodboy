import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button, Input, Textarea, cn } from '@goodboy/ui';
import type { SessionId, WorkspaceId, WorkspaceScriptId } from '@goodboy/types';
import { Check, Copy, Pencil, Play, Plus, ScrollText, Square, Trash2 } from 'lucide-react';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore } from '../../../../store';
import type { ScriptRunStatus } from '../../scripts';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId?: SessionId;
  readonly worktreePath?: string | null;
};

type Draft = { id: WorkspaceScriptId | null; name: string; body: string };

export const ScriptsPanel = ({ workspaceId, sessionId, worktreePath }: Props) => {
  const scripts = useAppStore((s) => s.workspaceScripts[workspaceId]);
  const loadScripts = useAppStore((s) => s.loadScripts);
  const saveScript = useAppStore((s) => s.saveScript);
  const deleteScript = useAppStore((s) => s.deleteScript);
  const runScript = useAppStore((s) => s.runScript);
  const cancelScript = useAppStore((s) => s.cancelScript);
  const runs = useAppStore((s) => (sessionId ? s.scriptRuns[sessionId] : undefined));

  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [logId, setLogId] = useState<WorkspaceScriptId | null>(null);

  const runnable = sessionId != null;

  useEffect(() => {
    void loadScripts(workspaceId);
  }, [workspaceId, loadScripts]);

  const onCopy = useCallback((id: string, body: string) => {
    void navigator.clipboard
      .writeText(body)
      .then(() => {
        setCopiedId(id);
        window.setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1200);
      })
      .catch(() => undefined);
  }, []);

  const onSaveDraft = useCallback(async () => {
    if (!draft) {
      return;
    }
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

  const onRun = useCallback(
    (id: WorkspaceScriptId) => {
      if (!sessionId || !worktreePath) {
        return;
      }
      void runScript(sessionId, id, worktreePath);
    },
    [runScript, sessionId, worktreePath],
  );

  const onCancel = useCallback(
    (id: WorkspaceScriptId) => {
      if (!sessionId) {
        return;
      }
      void cancelScript(sessionId, id);
    },
    [cancelScript, sessionId],
  );

  const list = scripts ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Shell scripts you run by hand from inside a session. cwd is the session worktree.
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

      {list.length === 0 && draft === null && (
        <p className="rounded-md border border-dashed border-border-soft px-3 py-6 text-center text-xs text-muted-foreground">
          No scripts yet. Create one, e.g. <code className="font-mono">copy environments</code>.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {list.map((script) => {
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
          const run = runs?.[script.id] ?? null;
          const status: ScriptRunStatus = run?.status ?? 'idle';
          const isPending = status === 'pending';
          const result = run?.result ?? null;
          const logOpen = logId === script.id;
          return (
            <li
              key={script.id}
              className="overflow-hidden rounded-md border border-border-soft bg-background"
            >
              <div className="flex items-center gap-2 px-3 py-2">
                {runnable ? <StatusDot status={status} /> : null}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {script.name}
                </span>
                {runnable ? (
                  isPending ? (
                    <RowAction
                      icon={<Square size={11} fill="currentColor" aria-hidden />}
                      label="stop script"
                      tone="danger"
                      onClick={() => onCancel(script.id)}
                    />
                  ) : (
                    <RowAction
                      icon={<Play size={13} aria-hidden />}
                      label="run script"
                      disabled={!worktreePath}
                      onClick={() => onRun(script.id)}
                    />
                  )
                ) : null}
                {runnable && result ? (
                  <RowAction
                    icon={<ScrollText size={13} aria-hidden />}
                    label={logOpen ? 'hide log' : 'show log'}
                    onClick={() => setLogId((prev) => (prev === script.id ? null : script.id))}
                  />
                ) : null}
                <RowAction
                  icon={
                    copiedId === script.id ? (
                      <Check size={13} aria-hidden className="text-success" />
                    ) : (
                      <Copy size={13} aria-hidden />
                    )
                  }
                  label="copy script"
                  onClick={() => onCopy(script.id, script.body)}
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
              {logOpen && result ? (
                <pre className="m-0 max-h-60 overflow-auto whitespace-pre-wrap break-all border-t border-border-soft bg-subtle/40 px-3 py-2 font-mono text-2xs leading-relaxed text-foreground/80">
                  {result.stdout}
                  {result.stderr ? (
                    <span className="text-danger">
                      {result.stdout ? '\n' : ''}
                      {result.stderr}
                    </span>
                  ) : null}
                  {!result.stdout && !result.stderr ? '(no output)' : null}
                </pre>
              ) : (
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all border-t border-border-soft bg-subtle/40 px-3 py-2 font-mono text-2xs leading-relaxed text-foreground/75">
                  {script.body}
                </pre>
              )}
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
};

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

function StatusDot({ status }: { readonly status: ScriptRunStatus }) {
  const tone =
    status === 'ok'
      ? 'bg-success'
      : status === 'error'
        ? 'bg-danger'
        : status === 'cancelled'
          ? 'bg-muted-foreground/50'
          : status === 'pending'
            ? 'animate-pulse bg-info'
            : 'bg-border';
  return <span aria-hidden className={cn('size-2 shrink-0 rounded-full', tone)} />;
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
        placeholder="script name (e.g. copy environments)"
        autoFocus
      />
      <Textarea
        value={draft.body}
        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        placeholder={'#!/bin/bash\ncp ../main/.env .env'}
        className="min-h-[160px] resize-y font-mono text-xs"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        rows={8}
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
