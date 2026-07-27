import { useCallback, useEffect, useState } from 'react';
import { Button, EmptyState } from '@goodboy/ui';
import type { SessionId, WorkspaceId, WorkspaceScript, WorkspaceScriptId } from '@goodboy/types';
import { Plus, SquareTerminal } from 'lucide-react';
import { InspectorSplit } from '../../../session/components/SessionWorkspace/parts/InspectorSplit';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore } from '../../../../store';
import { DiscardDraftDialog } from './DiscardDraftDialog';
import { ScriptEditor } from './ScriptEditor';
import { ScriptRow } from './ScriptRow';
import type { Draft, PendingAction } from './types';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId?: SessionId;
  readonly worktreePath?: string | null;
};

type Params = {
  readonly action: PendingAction | null;
};

export const ScriptsPanel = ({ workspaceId, sessionId, worktreePath }: Props) => {
  const scripts = useAppStore((s) => s.workspaceScripts[workspaceId]);
  const loadScripts = useAppStore((s) => s.loadScripts);
  const saveScript = useAppStore((s) => s.saveScript);
  const deleteScript = useAppStore((s) => s.deleteScript);
  const runScript = useAppStore((s) => s.runScript);
  const cancelScript = useAppStore((s) => s.cancelScript);
  const runs = useAppStore((s) => (sessionId != null ? s.scriptRuns[sessionId] : undefined));

  const [draft, setDraft] = useState<Draft | null>(null);
  const [original, setOriginal] = useState<{ name: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<WorkspaceScriptId | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [completedAt, setCompletedAt] = useState<Record<string, number>>({});

  const runnable = sessionId != null;
  const list = scripts ?? [];
  const dirty =
    draft !== null &&
    original !== null &&
    (draft.name !== original.name || draft.body !== original.body);
  const selectedRun = draft?.id != null ? (runs?.[draft.id] ?? null) : null;

  useEffect(() => {
    void loadScripts(workspaceId);
  }, [workspaceId, loadScripts]);

  useEffect(() => {
    if (runs === undefined) {
      return;
    }
    setCompletedAt((prev) => {
      let next = prev;
      for (const record of Object.values(runs)) {
        if (record.result !== null && prev[record.runId] === undefined) {
          next = next === prev ? { ...prev } : next;
          next[record.runId] = Date.now();
        }
      }
      return next;
    });
  }, [runs]);

  const openNewNow = useCallback(() => {
    setDraft({ id: null, name: '', body: '' });
    setOriginal({ name: '', body: '' });
    setError(null);
  }, []);

  const openExistingNow = useCallback((script: WorkspaceScript) => {
    setDraft({ id: script.id, name: script.name, body: script.body });
    setOriginal({ name: script.name, body: script.body });
    setError(null);
  }, []);

  const closeNow = useCallback(() => {
    setDraft(null);
    setOriginal(null);
    setError(null);
  }, []);

  const applyPendingTransition = useCallback(
    ({ action }: Params) => {
      if (action === null) {
        closeNow();
        return;
      }
      if (action.kind === 'new') {
        openNewNow();
        return;
      }
      if (action.kind === 'select') {
        openExistingNow(action.script);
        return;
      }
      closeNow();
    },
    [closeNow, openNewNow, openExistingNow],
  );

  const requestOpenNew = useCallback(() => {
    if (dirty) {
      setPendingAction({ kind: 'new' });
      return;
    }
    openNewNow();
  }, [dirty, openNewNow]);

  const requestSelect = useCallback(
    (script: WorkspaceScript) => {
      if (draft?.id === script.id) {
        return;
      }
      if (dirty) {
        setPendingAction({ kind: 'select', script });
        return;
      }
      openExistingNow(script);
    },
    [draft, dirty, openExistingNow],
  );

  const requestClose = useCallback(() => {
    if (draft === null) {
      return;
    }
    if (dirty) {
      setPendingAction({ kind: 'close' });
      return;
    }
    closeNow();
  }, [draft, dirty, closeNow]);

  const onSaveDraft = useCallback(async (): Promise<boolean> => {
    if (draft === null) {
      return false;
    }
    const name = draft.name.trim();
    const body = draft.body.trim();
    if (name === '' || body === '') {
      setError('name and script body are required');
      return false;
    }
    setError(null);
    try {
      await saveScript({ workspaceId, id: draft.id ?? undefined, name, body });
      return true;
    } catch (err) {
      setError(formatError(err));
      return false;
    }
  }, [draft, saveScript, workspaceId]);

  const onEditorSave = useCallback(() => {
    void (async () => {
      const ok = await onSaveDraft();
      if (ok) {
        closeNow();
      }
    })();
  }, [onSaveDraft, closeNow]);

  const onDialogCancel = useCallback(() => {
    setPendingAction(null);
  }, []);

  const onDialogDiscard = useCallback(() => {
    const action = pendingAction;
    setPendingAction(null);
    applyPendingTransition({ action });
  }, [pendingAction, applyPendingTransition]);

  const onDialogSave = useCallback(() => {
    void (async () => {
      const ok = await onSaveDraft();
      if (!ok) {
        return;
      }
      const action = pendingAction;
      setPendingAction(null);
      applyPendingTransition({ action });
    })();
  }, [onSaveDraft, pendingAction, applyPendingTransition]);

  const onCopy = useCallback((id: WorkspaceScriptId, body: string) => {
    void navigator.clipboard
      .writeText(body)
      .then(() => {
        setCopiedId(id);
        window.setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1200);
      })
      .catch(() => undefined);
  }, []);

  const onDelete = useCallback(
    async (id: WorkspaceScriptId) => {
      try {
        await deleteScript(id, workspaceId);
        if (draft?.id === id) {
          closeNow();
        }
      } catch (err) {
        setError(formatError(err));
      }
    },
    [deleteScript, workspaceId, draft, closeNow],
  );

  const onRun = useCallback(
    (script: WorkspaceScript) => {
      if (sessionId == null || worktreePath == null) {
        return;
      }
      if (draft?.id !== script.id) {
        openExistingNow(script);
      }
      void runScript(sessionId, script.id, worktreePath);
    },
    [runScript, sessionId, worktreePath, draft, openExistingNow],
  );

  const onCancel = useCallback(
    (id: WorkspaceScriptId) => {
      if (sessionId == null) {
        return;
      }
      void cancelScript(sessionId, id);
    },
    [cancelScript, sessionId],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Shell scripts you run by hand from inside a session. cwd is the session worktree. Scripts
          are shared across every session of this workspace.
        </p>
        <Button variant="ghost" size="sm" onClick={requestOpenNew}>
          <Plus size={13} aria-hidden />
          New script
        </Button>
      </div>

      {error !== null && draft === null ? <p className="text-xs text-danger">{error}</p> : null}

      <InspectorSplit
        open={draft !== null}
        panel={
          draft !== null ? (
            <ScriptEditor
              draft={draft}
              dirty={dirty}
              error={error}
              run={selectedRun}
              completedAt={selectedRun !== null ? completedAt[selectedRun.runId] : undefined}
              onNameChange={(name) => setDraft((d) => (d !== null ? { ...d, name } : d))}
              onBodyChange={(body) => setDraft((d) => (d !== null ? { ...d, body } : d))}
              onSave={onEditorSave}
              onCancel={requestClose}
            />
          ) : null
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {list.length === 0 ? (
            <EmptyState
              bordered
              tone="info"
              icon={SquareTerminal}
              title="No scripts yet"
              description="Create one to run setup or checks from inside this session."
            />
          ) : (
            <ul className="flex flex-col gap-1">
              {list.map((script) => (
                <li key={script.id}>
                  <ScriptRow
                    script={script}
                    status={runs?.[script.id]?.status ?? 'idle'}
                    selected={draft?.id === script.id}
                    runnable={runnable}
                    canRun={worktreePath != null}
                    copied={copiedId === script.id}
                    onSelect={() => requestSelect(script)}
                    onRun={() => onRun(script)}
                    onCancel={() => onCancel(script.id)}
                    onCopy={() => onCopy(script.id, script.body)}
                    onDelete={() => void onDelete(script.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </InspectorSplit>

      <DiscardDraftDialog
        open={pendingAction !== null}
        onSave={onDialogSave}
        onDiscard={onDialogDiscard}
        onCancel={onDialogCancel}
      />
    </div>
  );
};
