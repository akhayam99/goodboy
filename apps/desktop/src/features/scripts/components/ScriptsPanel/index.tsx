import { useCallback, useEffect, useState } from 'react';
import { Button, formatError, SectionHeader } from '@goodboy/ui';
import type { SessionId, WorkspaceId, ProjectScript, ProjectScriptId } from '@goodboy/types';
import { Plus } from 'lucide-react';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { LensEmptyState } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { DiscardDraftConfirm } from './DiscardDraftConfirm';
import { NewScriptCard } from './NewScriptCard';
import { ScriptRow } from './ScriptRow';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId?: SessionId;
  readonly worktreePath?: string | null;
  readonly hasHostHeading?: boolean;
};

const SCRIPTS_HINT =
  'Shell scripts you run by hand from inside a session. cwd is the session worktree. Scripts are shared across every session of this workspace.';

type NewDraft = {
  readonly name: string;
  readonly body: string;
};

type PendingNewAction = {
  readonly expandedId: ProjectScriptId | null;
};

type SaveNewResult =
  | { readonly kind: 'failed' }
  | { readonly kind: 'saved'; readonly scriptId: ProjectScriptId | null };

type SaveNewParams = Record<never, never>;

type ToggleParams = {
  readonly id: ProjectScriptId;
};

type CopyParams = {
  readonly id: ProjectScriptId;
  readonly body: string;
};

type DeleteParams = {
  readonly id: ProjectScriptId;
};

type RunParams = {
  readonly script: ProjectScript;
};

type CancelParams = {
  readonly id: ProjectScriptId;
};

type SaveExistingParams = {
  readonly script: ProjectScript;
  readonly name: string;
  readonly body: string;
};

export const ScriptsPanel = ({
  workspaceId,
  sessionId,
  worktreePath,
  hasHostHeading = false,
}: Props) => {
  const scripts = useAppStore((state) => state.projectScripts[workspaceId]);
  const loadScripts = useAppStore((state) => state.loadScripts);
  const saveScript = useAppStore((state) => state.saveScript);
  const deleteScript = useAppStore((state) => state.deleteScript);
  const runScript = useAppStore((state) => state.runScript);
  const cancelScript = useAppStore((state) => state.cancelScript);
  const runs = useAppStore((state) =>
    sessionId != null ? state.scriptRuns[sessionId] : undefined,
  );

  const [expandedId, setExpandedId] = useState<ProjectScriptId | null>(null);
  const [newDraft, setNewDraft] = useState<NewDraft | null>(null);
  const [pendingNewAction, setPendingNewAction] = useState<PendingNewAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<ProjectScriptId | null>(null);
  const [completedAt, setCompletedAt] = useState<Record<string, number>>({});

  const runnable = sessionId != null;
  const list = scripts ?? [];
  const newDraftDirty =
    newDraft != null && (newDraft.name.trim() !== '' || newDraft.body.trim() !== '');

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

  const saveNew = useCallback(
    async (_params: SaveNewParams): Promise<SaveNewResult> => {
      if (newDraft == null) {
        return { kind: 'failed' };
      }
      const name = newDraft.name.trim();
      const body = newDraft.body.trim();
      if (name === '' || body === '') {
        setError('name and script body are required');
        return { kind: 'failed' };
      }

      const previousIds = new Set(list.map((script) => script.id));
      setError(null);
      try {
        await saveScript({ workspaceId, id: undefined, name, body });
        const savedScript =
          useAppStore
            .getState()
            .projectScripts[workspaceId]?.find((script) => !previousIds.has(script.id)) ?? null;
        return { kind: 'saved', scriptId: savedScript?.id ?? null };
      } catch (caughtError) {
        setError(formatError(caughtError));
        return { kind: 'failed' };
      }
    },
    [list, newDraft, saveScript, workspaceId],
  );

  const onSaveNew = useCallback(() => {
    void (async () => {
      const result = await saveNew({});
      if (result.kind === 'failed') {
        return;
      }
      setNewDraft(null);
      setExpandedId(result.scriptId);
    })();
  }, [saveNew]);

  const onToggle = useCallback(
    ({ id }: ToggleParams) => {
      const target = expandedId === id ? null : id;
      if (newDraftDirty) {
        setPendingNewAction({ expandedId: target });
        return;
      }
      setNewDraft(null);
      setError(null);
      setExpandedId(target);
    },
    [expandedId, newDraftDirty],
  );

  const onOpenNew = useCallback(() => {
    if (newDraft != null) {
      return;
    }
    setExpandedId(null);
    setError(null);
    setNewDraft({ name: '', body: '' });
  }, [newDraft]);

  const onCancelNew = useCallback(() => {
    if (newDraftDirty) {
      setPendingNewAction({ expandedId: null });
      return;
    }
    setNewDraft(null);
    setError(null);
  }, [newDraftDirty]);

  const onDialogCancel = useCallback(() => {
    setPendingNewAction(null);
  }, []);

  const onDialogDiscard = useCallback(() => {
    const action = pendingNewAction;
    setPendingNewAction(null);
    setNewDraft(null);
    setError(null);
    setExpandedId(action?.expandedId ?? null);
  }, [pendingNewAction]);

  const onDialogSave = useCallback(() => {
    void (async () => {
      const result = await saveNew({});
      if (result.kind === 'failed') {
        return;
      }
      const action = pendingNewAction;
      setPendingNewAction(null);
      setNewDraft(null);
      setExpandedId(action?.expandedId ?? result.scriptId);
    })();
  }, [pendingNewAction, saveNew]);

  const onSaveExisting = useCallback(
    async ({ script, name, body }: SaveExistingParams) => {
      const nextName = name.trim();
      const nextBody = body.trim();
      if (nextName === '' || nextBody === '') {
        setError('name and script body are required');
        return;
      }
      if (nextName === script.name && nextBody === script.body) {
        return;
      }
      setError(null);
      try {
        await saveScript({
          workspaceId,
          id: script.id,
          name: nextName,
          body: nextBody,
        });
      } catch (caughtError) {
        setError(formatError(caughtError));
      }
    },
    [saveScript, workspaceId],
  );

  const onCopy = useCallback(({ id, body }: CopyParams) => {
    void navigator.clipboard
      .writeText(body)
      .then(() => {
        setCopiedId(id);
        window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1200);
      })
      .catch(() => undefined);
  }, []);

  const onDelete = useCallback(
    async ({ id }: DeleteParams) => {
      try {
        await deleteScript(id, workspaceId);
        setExpandedId((current) => (current === id ? null : current));
      } catch (caughtError) {
        setError(formatError(caughtError));
      }
    },
    [deleteScript, workspaceId],
  );

  const onRun = useCallback(
    ({ script }: RunParams) => {
      if (sessionId == null || worktreePath == null) {
        return;
      }
      void runScript(sessionId, script.id, worktreePath);
    },
    [runScript, sessionId, worktreePath],
  );

  const onCancel = useCallback(
    ({ id }: CancelParams) => {
      if (sessionId == null) {
        return;
      }
      void cancelScript(sessionId, id);
    },
    [cancelScript, sessionId],
  );

  const newScriptAction = (
    <Button variant="ghost" size="sm" onClick={onOpenNew}>
      <Plus size={13} aria-hidden />
      New script
    </Button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {hasHostHeading ? (
        <div className="flex items-start justify-between gap-2">
          <p className="text-2xs text-muted-foreground/70">{SCRIPTS_HINT}</p>
          {list.length > 0 ? newScriptAction : null}
        </div>
      ) : (
        <SectionHeader
          label="Scripts"
          icon={<CONCEPT_ICONS.scripts size={13} aria-hidden />}
          hint={SCRIPTS_HINT}
          action={list.length > 0 ? newScriptAction : null}
        />
      )}

      {error !== null && newDraft === null ? <p className="text-xs text-danger">{error}</p> : null}

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {newDraft != null ? (
          <NewScriptCard
            name={newDraft.name}
            body={newDraft.body}
            error={error}
            onNameChange={(name) =>
              setNewDraft((current) => (current == null ? null : { ...current, name }))
            }
            onBodyChange={(body) =>
              setNewDraft((current) => (current == null ? null : { ...current, body }))
            }
            onSave={onSaveNew}
            onCancel={onCancelNew}
          />
        ) : null}
        {list.length === 0 && newDraft == null ? (
          <LensEmptyState
            tone={CONCEPT_TONE.scripts}
            icon={CONCEPT_ICONS.scripts}
            title="No scripts yet"
            description="A script is a shell command you run by hand from a session, no agent, no tokens spent. Create one to run setup or checks from the session worktree."
            action={newScriptAction}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((script) => {
              const run = runs?.[script.id] ?? null;
              return (
                <li key={script.id}>
                  <ScriptRow
                    script={script}
                    run={run}
                    completedAt={run == null ? undefined : completedAt[run.runId]}
                    expanded={expandedId === script.id}
                    runnable={runnable}
                    canRun={worktreePath != null}
                    copied={copiedId === script.id}
                    onToggle={() => onToggle({ id: script.id })}
                    onSave={(name, body) => onSaveExisting({ script, name, body })}
                    onRun={() => onRun({ script })}
                    onCancel={() => onCancel({ id: script.id })}
                    onCopy={() => onCopy({ id: script.id, body: script.body })}
                    onDelete={() => onDelete({ id: script.id })}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {pendingNewAction !== null ? (
        <DiscardDraftConfirm
          onSave={onDialogSave}
          onDiscard={onDialogDiscard}
          onCancel={onDialogCancel}
        />
      ) : null}
    </div>
  );
};
