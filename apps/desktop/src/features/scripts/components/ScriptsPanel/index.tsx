import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  formatError,
  SectionHeader,
  SegmentedTabs,
  type SegmentedTabOption,
} from '@goodboy/ui';
import type {
  Project,
  ProjectId,
  SessionId,
  WorkspaceId,
  ProjectScript,
  ProjectScriptId,
  SessionProjectMount,
} from '@goodboy/types';
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
  readonly hasHostHeading?: boolean;
};

const SCRIPTS_HINT =
  "Shell scripts you run by hand from inside a session. Each script belongs to a project and runs in that project's worktree for this session. Scripts are shared across every session of the workspace.";

type NewDraft = {
  readonly name: string;
  readonly body: string;
  readonly projectId: ProjectId | null;
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
  readonly projectId: ProjectId;
};

type ProjectFilter = 'all' | ProjectId;

type ScriptGroup = {
  readonly key: string;
  readonly label: string | null;
  readonly scripts: ReadonlyArray<ProjectScript>;
};

const EMPTY_MOUNTS: ReadonlyArray<SessionProjectMount> = [];

export const ScriptsPanel = ({ workspaceId, sessionId, hasHostHeading = false }: Props) => {
  const scripts = useAppStore((state) => state.projectScripts[workspaceId]);
  const allProjects = useAppStore((state) => state.projects);
  const sessionMounts = useAppStore((state) =>
    sessionId == null ? EMPTY_MOUNTS : (state.sessionProjectMounts[sessionId] ?? EMPTY_MOUNTS),
  );
  const activeProjectId = useAppStore((state) => {
    if (sessionId == null) {
      return null;
    }
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    return state.sessionActiveProject[sessionId] ?? session?.activeProjectId ?? null;
  });
  const loadScripts = useAppStore((state) => state.loadScripts);
  const saveScript = useAppStore((state) => state.saveScript);
  const deleteScript = useAppStore((state) => state.deleteScript);
  const runScript = useAppStore((state) => state.runScript);
  const cancelScript = useAppStore((state) => state.cancelScript);
  const scriptsLensScope = useAppStore((state) => state.scriptsLensScope);
  const setScriptsLensScope = useAppStore((state) => state.setScriptsLensScope);
  const runs = useAppStore((state) =>
    sessionId != null ? state.scriptRuns[sessionId] : undefined,
  );

  const [expandedId, setExpandedId] = useState<ProjectScriptId | null>(null);
  const [newDraft, setNewDraft] = useState<NewDraft | null>(null);
  const [pendingNewAction, setPendingNewAction] = useState<PendingNewAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<ProjectScriptId | null>(null);
  const [completedAt, setCompletedAt] = useState<Record<string, number>>({});
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>(() => {
    const scoped = scriptsLensScope?.projectId;
    if (scoped == null) {
      return 'all';
    }
    const belongs = allProjects.some(
      (project) => project.id === scoped && project.workspaceId === workspaceId,
    );
    return belongs ? scoped : 'all';
  });

  const runnable = sessionId != null;
  const list = scripts ?? [];
  const projects = useMemo(
    () => allProjects.filter((project) => project.workspaceId === workspaceId),
    [allProjects, workspaceId],
  );
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const mountPathByProjectId = useMemo(
    () => new Map(sessionMounts.map((mount) => [mount.projectId, mount.worktreePath])),
    [sessionMounts],
  );
  const isMultiProject = projects.length > 1;
  const defaultProjectId = activeProjectId ?? projects[0]?.id ?? null;
  const projectFilterOptions = useMemo<ReadonlyArray<SegmentedTabOption<ProjectFilter>>>(
    () => [
      { value: 'all', label: 'All' },
      ...[...projects]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((project) => ({ value: project.id, label: project.name })),
    ],
    [projects],
  );
  const groups = useMemo<ReadonlyArray<ScriptGroup>>(() => {
    const sortScripts = (groupScripts: ReadonlyArray<ProjectScript>) =>
      [...groupScripts].sort((left, right) =>
        left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
      );
    if (!isMultiProject) {
      return [{ key: 'all', label: null, scripts: sortScripts(list) }];
    }
    if (projectFilter !== 'all') {
      return [
        {
          key: projectFilter,
          label: null,
          scripts: sortScripts(list.filter((script) => script.projectId === projectFilter)),
        },
      ];
    }
    return [...projects]
      .sort((left, right) => left.name.localeCompare(right.name))
      .flatMap((project) => {
        const projectScripts = sortScripts(
          list.filter((script) => script.projectId === project.id),
        );
        return projectScripts.length === 0
          ? []
          : [{ key: project.id, label: project.name, scripts: projectScripts }];
      });
  }, [isMultiProject, list, projectFilter, projects]);
  const newDraftDirty =
    newDraft != null && (newDraft.name.trim() !== '' || newDraft.body.trim() !== '');

  useEffect(() => {
    void loadScripts(workspaceId);
  }, [workspaceId, loadScripts]);

  useEffect(() => {
    setScriptsLensScope({ scope: null });
  }, [setScriptsLensScope]);

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
        if (newDraft.projectId == null) {
          setError('project is required');
          return { kind: 'failed' };
        }
        await saveScript({
          workspaceId,
          projectId: newDraft.projectId,
          id: undefined,
          name,
          body,
        });
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
    setNewDraft({ name: '', body: '', projectId: defaultProjectId });
  }, [defaultProjectId, newDraft]);

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
    async ({ script, name, body, projectId }: SaveExistingParams) => {
      const nextName = name.trim();
      const nextBody = body.trim();
      if (nextName === '' || nextBody === '') {
        setError('name and script body are required');
        return;
      }
      if (nextName === script.name && nextBody === script.body && projectId === script.projectId) {
        return;
      }
      setError(null);
      try {
        await saveScript({
          workspaceId,
          projectId,
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
      if (sessionId == null) {
        return;
      }
      void runScript({ sessionId, scriptId: script.id });
    },
    [runScript, sessionId],
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
        {isMultiProject ? (
          <SegmentedTabs
            ariaLabel="Filter scripts by project"
            options={projectFilterOptions}
            value={projectFilter}
            onChange={setProjectFilter}
            size="sm"
            className="max-w-full flex-wrap self-start"
          />
        ) : null}
        {newDraft != null ? (
          newDraft.projectId != null ? (
            <NewScriptCard
              name={newDraft.name}
              body={newDraft.body}
              projects={projects}
              projectId={newDraft.projectId}
              error={error}
              onNameChange={(name) =>
                setNewDraft((current) => (current == null ? null : { ...current, name }))
              }
              onBodyChange={(body) =>
                setNewDraft((current) => (current == null ? null : { ...current, body }))
              }
              onProjectChange={(projectId) =>
                setNewDraft((current) => (current == null ? null : { ...current, projectId }))
              }
              onSave={onSaveNew}
              onCancel={onCancelNew}
            />
          ) : null
        ) : null}
        {list.length === 0 && newDraft == null ? (
          <LensEmptyState
            tone={CONCEPT_TONE.scripts}
            icon={CONCEPT_ICONS.scripts}
            title="No scripts yet"
            description="Each script belongs to a project and runs in that project's worktree for this session. Scripts are shared across every session of the workspace."
            action={newScriptAction}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.key} className="flex flex-col gap-1.5">
                {group.label != null ? (
                  <div className="flex items-center gap-2 px-0.5">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                      {group.label}
                    </span>
                    <span className="text-2xs tabular-nums text-muted-foreground/50">
                      {group.scripts.length}
                    </span>
                    <span className="h-px flex-1 bg-border/40" aria-hidden />
                  </div>
                ) : null}
                <ul className="flex flex-col gap-2">
                  {group.scripts.map((script) => {
                    const run = runs?.[script.id] ?? null;
                    const project = projectById.get(script.projectId) ?? null;
                    const projectName = project?.name ?? 'Project';
                    const mountPath = mountPathByProjectId.get(script.projectId) ?? null;
                    const runDisabledReason =
                      runnable && mountPath == null
                        ? `${projectName} is not mounted in this session`
                        : null;
                    return (
                      <li key={script.id}>
                        <ScriptRow
                          script={script}
                          projects={projects}
                          projectName={projectName}
                          mountPath={mountPath}
                          run={run}
                          completedAt={run == null ? undefined : completedAt[run.runId]}
                          expanded={expandedId === script.id}
                          runnable={runnable}
                          canRun={mountPath != null}
                          runDisabledReason={runDisabledReason}
                          copied={copiedId === script.id}
                          onToggle={() => onToggle({ id: script.id })}
                          onSave={(name, body, projectId) =>
                            onSaveExisting({ script, name, body, projectId })
                          }
                          onRun={() => onRun({ script })}
                          onCancel={() => onCancel({ id: script.id })}
                          onCopy={() => onCopy({ id: script.id, body: script.body })}
                          onDelete={() => onDelete({ id: script.id })}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
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
