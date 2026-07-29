import { useCallback, useEffect, useState } from 'react';
import { Button, EmptyState } from '@goodboy/ui';
import type { SessionId, WorkspaceId, WorkspaceScript, WorkspaceScriptId } from '@goodboy/types';
import { Plus, SquareTerminal } from 'lucide-react';
import { InspectorSplit } from '../../../session/components/SessionWorkspace/parts/InspectorSplit';
import { InspectorHeader } from '../../../session/components/SessionWorkspace/parts/InspectorSplit/InspectorHeader';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore } from '../../../../store';
import { DiscardDraftConfirm } from './DiscardDraftConfirm';
import { ScriptDetail } from './ScriptDetail';
import { ScriptEditor } from './ScriptEditor';
import { ScriptRow } from './ScriptRow';
import type { PanelState, PendingAction } from './types';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId?: SessionId;
  readonly worktreePath?: string | null;
};

type TransitionParams = {
  readonly target: PanelState;
};

type SaveResult =
  | { readonly kind: 'failed' }
  | { readonly kind: 'saved'; readonly scriptId: WorkspaceScriptId | null };

const CLOSED_PANEL = { kind: 'closed' } satisfies PanelState;

export const ScriptsPanel = ({ workspaceId, sessionId, worktreePath }: Props) => {
  const scripts = useAppStore((state) => state.workspaceScripts[workspaceId]);
  const loadScripts = useAppStore((state) => state.loadScripts);
  const saveScript = useAppStore((state) => state.saveScript);
  const deleteScript = useAppStore((state) => state.deleteScript);
  const runScript = useAppStore((state) => state.runScript);
  const cancelScript = useAppStore((state) => state.cancelScript);
  const runs = useAppStore((state) =>
    sessionId != null ? state.scriptRuns[sessionId] : undefined,
  );

  const [panelState, setPanelState] = useState<PanelState>(CLOSED_PANEL);
  const [original, setOriginal] = useState<{ name: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<WorkspaceScriptId | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [completedAt, setCompletedAt] = useState<Record<string, number>>({});

  const runnable = sessionId != null;
  const list = scripts ?? [];
  const draft = panelState.kind === 'edit' ? panelState.draft : null;
  const dirty =
    draft !== null &&
    original !== null &&
    (draft.name !== original.name || draft.body !== original.body);
  const selectedScriptId =
    panelState.kind === 'detail'
      ? panelState.scriptId
      : panelState.kind === 'edit'
        ? panelState.draft.id
        : null;
  const detailScript =
    panelState.kind === 'detail'
      ? (list.find((script) => script.id === panelState.scriptId) ?? null)
      : null;
  const selectedRun = selectedScriptId !== null ? (runs?.[selectedScriptId] ?? null) : null;

  useEffect(() => {
    void loadScripts(workspaceId);
  }, [workspaceId, loadScripts]);

  useEffect(() => {
    if (runs === undefined) {
      return;
    }
    setCompletedAt((previous) => {
      let next = previous;
      for (const record of Object.values(runs)) {
        if (record.result !== null && previous[record.runId] === undefined) {
          next = next === previous ? { ...previous } : next;
          next[record.runId] = Date.now();
        }
      }
      return next;
    });
  }, [runs]);

  const applyTransition = useCallback(({ target }: TransitionParams) => {
    setPanelState(target);
    setError(null);
    if (target.kind === 'edit') {
      setOriginal({ name: target.draft.name, body: target.draft.body });
      return;
    }
    setOriginal(null);
  }, []);

  const requestTransition = useCallback(
    ({ target }: TransitionParams) => {
      if (dirty) {
        setPendingAction({ target });
        return;
      }
      applyTransition({ target });
    },
    [applyTransition, dirty],
  );

  useEffect(() => {
    if (panelState.kind === 'closed' || pendingAction !== null) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      requestTransition({ target: CLOSED_PANEL });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panelState.kind, pendingAction, requestTransition]);

  const requestOpenNew = useCallback(() => {
    requestTransition({
      target: { kind: 'edit', draft: { id: null, name: '', body: '' } },
    });
  }, [requestTransition]);

  const requestDetail = useCallback(
    (script: WorkspaceScript) => {
      requestTransition({ target: { kind: 'detail', scriptId: script.id } });
    },
    [requestTransition],
  );

  const requestEdit = useCallback(
    (script: WorkspaceScript) => {
      requestTransition({
        target: {
          kind: 'edit',
          draft: { id: script.id, name: script.name, body: script.body },
        },
      });
    },
    [requestTransition],
  );

  const requestCancelEdit = useCallback(() => {
    if (panelState.kind !== 'edit') {
      return;
    }
    const target =
      panelState.draft.id === null
        ? CLOSED_PANEL
        : ({ kind: 'detail', scriptId: panelState.draft.id } satisfies PanelState);
    requestTransition({ target });
  }, [panelState, requestTransition]);

  const requestClose = useCallback(() => {
    requestTransition({ target: CLOSED_PANEL });
  }, [requestTransition]);

  const onSaveDraft = useCallback(async (): Promise<SaveResult> => {
    if (draft === null) {
      return { kind: 'failed' };
    }
    const name = draft.name.trim();
    const body = draft.body.trim();
    if (name === '' || body === '') {
      setError('name and script body are required');
      return { kind: 'failed' };
    }
    setError(null);
    const previousIds = new Set(list.map((script) => script.id));
    try {
      await saveScript({ workspaceId, id: draft.id ?? undefined, name, body });
      if (draft.id !== null) {
        return { kind: 'saved', scriptId: draft.id };
      }
      const savedScript =
        useAppStore
          .getState()
          .workspaceScripts[workspaceId]?.find((script) => !previousIds.has(script.id)) ?? null;
      return { kind: 'saved', scriptId: savedScript?.id ?? null };
    } catch (caughtError) {
      setError(formatError(caughtError));
      return { kind: 'failed' };
    }
  }, [draft, list, saveScript, workspaceId]);

  const onEditorSave = useCallback(() => {
    void (async () => {
      const result = await onSaveDraft();
      if (result.kind === 'failed') {
        return;
      }
      if (result.scriptId === null) {
        applyTransition({ target: CLOSED_PANEL });
        return;
      }
      applyTransition({ target: { kind: 'detail', scriptId: result.scriptId } });
    })();
  }, [applyTransition, onSaveDraft]);

  const onDialogCancel = useCallback(() => {
    setPendingAction(null);
  }, []);

  const onDialogDiscard = useCallback(() => {
    const action = pendingAction;
    setPendingAction(null);
    if (action === null) {
      return;
    }
    applyTransition({ target: action.target });
  }, [applyTransition, pendingAction]);

  const onDialogSave = useCallback(() => {
    void (async () => {
      const result = await onSaveDraft();
      if (result.kind === 'failed') {
        return;
      }
      const action = pendingAction;
      setPendingAction(null);
      if (action === null) {
        return;
      }
      applyTransition({ target: action.target });
    })();
  }, [applyTransition, onSaveDraft, pendingAction]);

  const onCopy = useCallback((id: WorkspaceScriptId, body: string) => {
    void navigator.clipboard
      .writeText(body)
      .then(() => {
        setCopiedId(id);
        window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1200);
      })
      .catch(() => undefined);
  }, []);

  const onDelete = useCallback(
    async (id: WorkspaceScriptId) => {
      try {
        await deleteScript(id, workspaceId);
        if (selectedScriptId === id) {
          applyTransition({ target: CLOSED_PANEL });
        }
      } catch (caughtError) {
        setError(formatError(caughtError));
      }
    },
    [applyTransition, deleteScript, selectedScriptId, workspaceId],
  );

  const onRun = useCallback(
    (script: WorkspaceScript) => {
      if (sessionId == null || worktreePath == null) {
        return;
      }
      void runScript(sessionId, script.id, worktreePath);
    },
    [runScript, sessionId, worktreePath],
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

      {error !== null && panelState.kind !== 'edit' ? (
        <p className="text-xs text-danger">{error}</p>
      ) : null}

      <InspectorSplit
        open={panelState.kind !== 'closed'}
        panel={
          panelState.kind === 'detail' && detailScript !== null ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <InspectorHeader
                title={detailScript.name}
                closeLabel="Close script panel"
                onClose={requestClose}
              />
              <ScriptDetail
                script={detailScript}
                run={selectedRun}
                completedAt={selectedRun !== null ? completedAt[selectedRun.runId] : undefined}
                onEdit={() => requestEdit(detailScript)}
              />
            </div>
          ) : panelState.kind === 'edit' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <InspectorHeader
                title={panelState.draft.id === null ? 'New script' : panelState.draft.name}
                closeLabel="Close script panel"
                onClose={requestClose}
              />
              <ScriptEditor
                draft={panelState.draft}
                dirty={dirty}
                error={error}
                run={selectedRun}
                completedAt={selectedRun !== null ? completedAt[selectedRun.runId] : undefined}
                onNameChange={(name) =>
                  setPanelState((current) =>
                    current.kind === 'edit'
                      ? { ...current, draft: { ...current.draft, name } }
                      : current,
                  )
                }
                onBodyChange={(body) =>
                  setPanelState((current) =>
                    current.kind === 'edit'
                      ? { ...current, draft: { ...current.draft, body } }
                      : current,
                  )
                }
                onSave={onEditorSave}
                onCancel={requestCancelEdit}
              />
            </div>
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
                    run={runs?.[script.id] ?? null}
                    selected={selectedScriptId === script.id}
                    runnable={runnable}
                    canRun={worktreePath != null}
                    copied={copiedId === script.id}
                    onSelect={() => requestDetail(script)}
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

      {pendingAction !== null && (
        <DiscardDraftConfirm
          onSave={onDialogSave}
          onDiscard={onDialogDiscard}
          onCancel={onDialogCancel}
        />
      )}
    </div>
  );
};
