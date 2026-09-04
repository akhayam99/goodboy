import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Chip,
  Divider,
  formatError,
  LensEmptyState,
  PANE_RHYTHM,
  RefreshIconButton,
  ScrollFade,
  SectionHeader,
  cn,
} from '@goodboy/ui';
import type {
  Project,
  ProjectId,
  ProjectScript,
  ProjectScriptId,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { Plus } from 'lucide-react';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { readScriptsProject, writeScriptsProject } from '../../projectSelectionStorage';
import { discoveredScriptId, type ScriptGroup as ManifestScriptGroup } from '../../scripts';
import { DiscardDraftConfirm } from './DiscardDraftConfirm';
import { DiscoveredScriptGroup } from './DiscoveredScriptGroup';
import { ManifestSearchInput } from './ManifestSearchInput';
import { NewScriptCard } from './NewScriptCard';
import { ProjectRail, type ProjectRailEntry } from './ProjectRail';
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
  | {
      readonly kind: 'saved';
      readonly scriptId: ProjectScriptId | null;
      readonly projectId: ProjectId;
    };

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

type DiscoveredGroupEntry = {
  readonly group: ManifestScriptGroup;
  readonly worktreePath: string;
};

type RunDiscoveredParams = {
  readonly scriptId: string;
  readonly name: string;
  readonly command: string;
  readonly cwd: string;
};

type CancelDiscoveredParams = {
  readonly scriptId: string;
};

type SearchTarget = {
  readonly name: string;
  readonly command: string;
};

type SortScriptsParams = {
  readonly scripts: ReadonlyArray<ProjectScript>;
};

type InitialProjectParams = {
  readonly workspaceId: WorkspaceId;
  readonly projects: ReadonlyArray<Project>;
  readonly scopedProjectId: ProjectId | null;
  readonly activeProjectId: ProjectId | null;
};

type ShortenPathParams = {
  readonly path: string;
};

const EMPTY_MOUNTS: ReadonlyArray<SessionProjectMount> = [];

const sortScripts = ({ scripts }: SortScriptsParams): ReadonlyArray<ProjectScript> =>
  [...scripts].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
  );

const initialProject = ({
  workspaceId,
  projects,
  scopedProjectId,
  activeProjectId,
}: InitialProjectParams): ProjectId | null => {
  const projectIds = new Set(projects.map((project) => project.id));
  if (scopedProjectId !== null && projectIds.has(scopedProjectId)) {
    return scopedProjectId;
  }
  const storedProjectId = readScriptsProject({ workspaceId });
  if (storedProjectId !== null && projectIds.has(storedProjectId)) {
    return storedProjectId;
  }
  if (activeProjectId !== null && projectIds.has(activeProjectId)) {
    return activeProjectId;
  }
  return projects[0]?.id ?? null;
};

const shortenPath = ({ path }: ShortenPathParams): string => {
  const parts = path.split(/[\\/]/).filter((part) => part !== '');
  if (parts.length <= 4) {
    return path;
  }
  return `…/${parts.slice(-3).join('/')}`;
};

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
  const loadDiscoveredScripts = useAppStore((state) => state.loadDiscoveredScripts);
  const refreshDiscoveredScripts = useAppStore((state) => state.refreshDiscoveredScripts);
  const runDiscoveredScript = useAppStore((state) => state.runDiscoveredScript);
  const discoveredScripts = useAppStore((state) =>
    sessionId == null ? undefined : state.discoveredScripts[sessionId],
  );
  const discoveredScriptScans = useAppStore((state) =>
    sessionId == null ? undefined : state.discoveredScriptScans[sessionId],
  );
  const runs = useAppStore((state) =>
    sessionId == null ? undefined : state.scriptRuns[sessionId],
  );

  const list = scripts ?? [];
  const workspaceProjects = useMemo(
    () => allProjects.filter((project) => project.workspaceId === workspaceId),
    [allProjects, workspaceId],
  );
  const projectById = useMemo(
    () => new Map(workspaceProjects.map((project) => [project.id, project])),
    [workspaceProjects],
  );
  const mountByProjectId = useMemo(
    () => new Map(sessionMounts.map((mount) => [mount.projectId, mount])),
    [sessionMounts],
  );
  const projects = useMemo(() => {
    const scriptProjectIds = new Set(list.map((script) => script.projectId));
    const mountProjectIds = new Set(sessionMounts.map((mount) => mount.projectId));
    return workspaceProjects
      .filter((project) => {
        if (scriptProjectIds.has(project.id)) {
          return true;
        }
        return sessionId != null && mountProjectIds.has(project.id);
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [list, sessionId, sessionMounts, workspaceProjects]);

  const [scopedProjectId] = useState<ProjectId | null>(() => scriptsLensScope?.projectId ?? null);
  const [selectedProjectId, setSelectedProjectId] = useState<ProjectId | null>(() =>
    initialProject({
      workspaceId,
      projects,
      scopedProjectId,
      activeProjectId,
    }),
  );
  const [expandedId, setExpandedId] = useState<ProjectScriptId | null>(null);
  const [newDraft, setNewDraft] = useState<NewDraft | null>(null);
  const [pendingNewAction, setPendingNewAction] = useState<PendingNewAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<ProjectScriptId | null>(null);
  const [completedAt, setCompletedAt] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [manifestGroupOpen, setManifestGroupOpen] = useState<Record<string, boolean>>({});

  const selectedProject =
    selectedProjectId == null ? null : (projectById.get(selectedProjectId) ?? null);
  const selectedMount =
    selectedProjectId == null ? null : (mountByProjectId.get(selectedProjectId) ?? null);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const matchesSearch = useCallback(
    ({ name, command }: SearchTarget) =>
      normalizedQuery === '' ||
      name.toLocaleLowerCase().includes(normalizedQuery) ||
      command.toLocaleLowerCase().includes(normalizedQuery),
    [normalizedQuery],
  );
  const selectedUserScripts = useMemo(
    () =>
      sortScripts({
        scripts: list.filter(
          (script) =>
            script.projectId === selectedProjectId &&
            matchesSearch({ name: script.name, command: script.body }),
        ),
      }),
    [list, matchesSearch, selectedProjectId],
  );
  const selectedDiscoveredGroups = useMemo<ReadonlyArray<DiscoveredGroupEntry>>(() => {
    if (selectedMount === null) {
      return [];
    }
    const groups = [...(discoveredScripts?.[selectedMount.worktreePath] ?? [])].sort(
      (left, right) => {
        if (left.source !== right.source) {
          return left.source === 'composer' ? 1 : -1;
        }
        const leftRoot = left.relDir === '';
        const rightRoot = right.relDir === '';
        if (leftRoot !== rightRoot) {
          return leftRoot ? -1 : 1;
        }
        return left.relDir.localeCompare(right.relDir);
      },
    );
    return groups.flatMap((group) => {
      const matchingScripts = group.scripts.filter((script) => matchesSearch(script));
      if (matchingScripts.length === 0) {
        return [];
      }
      return [
        {
          group: { ...group, scripts: matchingScripts },
          worktreePath: selectedMount.worktreePath,
        },
      ];
    });
  }, [discoveredScripts, matchesSearch, selectedMount]);
  const railEntries = useMemo<ReadonlyArray<ProjectRailEntry>>(
    () =>
      projects.map((project) => {
        const projectScripts = list.filter((script) => script.projectId === project.id);
        const mount = mountByProjectId.get(project.id) ?? null;
        const manifestGroups = mount == null ? [] : (discoveredScripts?.[mount.worktreePath] ?? []);
        const manifestCount = manifestGroups.reduce(
          (total, group) => total + group.scripts.length,
          0,
        );
        const matchCount =
          projectScripts.filter((script) =>
            matchesSearch({ name: script.name, command: script.body }),
          ).length +
          manifestGroups.reduce(
            (total, group) =>
              total + group.scripts.filter((script) => matchesSearch(script)).length,
            0,
          );
        const hasRunningUserScript = projectScripts.some(
          (script) => runs?.[script.id]?.status === 'pending',
        );
        const hasRunningManifestScript =
          mount !== null &&
          manifestGroups.some((group) =>
            group.scripts.some((script) => {
              const scriptId = discoveredScriptId({
                worktreePath: mount.worktreePath,
                source: group.source,
                relDir: group.relDir,
                name: script.name,
              });
              return runs?.[scriptId]?.status === 'pending';
            }),
          );
        return {
          id: project.id,
          name: project.name,
          userCount: projectScripts.length,
          manifestCount,
          matchCount,
          isRunning: hasRunningUserScript || hasRunningManifestScript,
        };
      }),
    [discoveredScripts, list, matchesSearch, mountByProjectId, projects, runs],
  );
  const selectedManifestCount = selectedDiscoveredGroups.reduce(
    (total, entry) => total + entry.group.scripts.length,
    0,
  );
  const selectedScan =
    selectedMount === null ? undefined : discoveredScriptScans?.[selectedMount.worktreePath];
  const isDiscoveryLoading =
    selectedScan === undefined && selectedMount !== null
      ? true
      : selectedScan?.status === 'loading';
  const discoveryError = selectedScan?.status === 'error' ? selectedScan.error : null;
  const hasSearchResults = selectedUserScripts.length > 0 || selectedManifestCount > 0;
  const runnable = sessionId != null;
  const newDraftDirty =
    newDraft != null && (newDraft.name.trim() !== '' || newDraft.body.trim() !== '');
  const defaultProjectId = selectedProjectId ?? activeProjectId ?? workspaceProjects[0]?.id ?? null;

  useEffect(() => {
    void loadScripts(workspaceId);
  }, [workspaceId, loadScripts]);

  useEffect(() => {
    if (sessionId == null) {
      return;
    }
    for (const mount of sessionMounts) {
      void loadDiscoveredScripts({ sessionId, worktreePath: mount.worktreePath });
    }
  }, [loadDiscoveredScripts, sessionId, sessionMounts]);

  useEffect(() => {
    setScriptsLensScope({ scope: null });
  }, [setScriptsLensScope]);

  useEffect(() => {
    if (
      selectedProjectId !== null &&
      projects.some((project) => project.id === selectedProjectId)
    ) {
      return;
    }
    setSelectedProjectId(
      initialProject({
        workspaceId,
        projects,
        scopedProjectId,
        activeProjectId,
      }),
    );
  }, [activeProjectId, projects, scopedProjectId, selectedProjectId, workspaceId]);

  useEffect(() => {
    if (selectedProjectId === null) {
      return;
    }
    writeScriptsProject({ workspaceId, projectId: selectedProjectId });
  }, [selectedProjectId, workspaceId]);

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
        setError('Name and script body are required');
        return { kind: 'failed' };
      }
      if (newDraft.projectId == null) {
        setError('Project is required');
        return { kind: 'failed' };
      }
      const projectId = newDraft.projectId;
      const previousIds = new Set(list.map((script) => script.id));
      setError(null);
      try {
        await saveScript({ workspaceId, projectId, id: undefined, name, body });
        const savedScript =
          useAppStore
            .getState()
            .projectScripts[workspaceId]?.find((script) => !previousIds.has(script.id)) ?? null;
        return { kind: 'saved', scriptId: savedScript?.id ?? null, projectId };
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
      setSelectedProjectId(result.projectId);
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
    if (newDraft != null || defaultProjectId === null) {
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
      setSelectedProjectId(result.projectId);
      setExpandedId(action?.expandedId ?? result.scriptId);
    })();
  }, [pendingNewAction, saveNew]);

  const onSaveExisting = useCallback(
    async ({ script, name, body, projectId }: SaveExistingParams) => {
      const nextName = name.trim();
      const nextBody = body.trim();
      if (nextName === '' || nextBody === '') {
        setError('Name and script body are required');
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

  const onRunDiscovered = useCallback(
    ({ scriptId, name, command, cwd }: RunDiscoveredParams) => {
      if (sessionId == null) {
        return;
      }
      void runDiscoveredScript({ sessionId, scriptId, name, command, cwd });
    },
    [runDiscoveredScript, sessionId],
  );

  const onCancelDiscovered = useCallback(
    ({ scriptId }: CancelDiscoveredParams) => {
      if (sessionId == null) {
        return;
      }
      void cancelScript(sessionId, scriptId);
    },
    [cancelScript, sessionId],
  );

  const onRefreshDiscovered = useCallback(() => {
    if (sessionId == null || selectedMount === null) {
      return;
    }
    void refreshDiscoveredScripts({ sessionId, worktreePath: selectedMount.worktreePath });
  }, [refreshDiscoveredScripts, selectedMount, sessionId]);

  const onSelectProject = useCallback(({ projectId }: { readonly projectId: ProjectId }) => {
    setSelectedProjectId(projectId);
    setExpandedId(null);
    setError(null);
  }, []);

  const newScriptAction =
    workspaceProjects.length === 0 ? null : (
      <Button variant="ghost" size="sm" onClick={onOpenNew}>
        <Plus size={13} aria-hidden />
        New script
      </Button>
    );

  const topHeading = hasHostHeading ? (
    <p className="shrink-0 text-2xs text-muted-foreground/70">{SCRIPTS_HINT}</p>
  ) : (
    <SectionHeader
      label="Scripts"
      icon={<CONCEPT_ICONS.scripts size={13} aria-hidden />}
      hint={SCRIPTS_HINT}
    />
  );

  if (selectedProject === null || selectedProjectId === null) {
    return (
      <div className={cn('flex h-full min-h-0 flex-col', PANE_RHYTHM.stack)}>
        {topHeading}
        <LensEmptyState
          tone={CONCEPT_TONE.scripts}
          icon={CONCEPT_ICONS.scripts}
          title="No scripts yet"
          description="Create a script for a project to keep repeatable commands close at hand."
          action={newScriptAction}
        />
        {newDraft !== null && newDraft.projectId !== null ? (
          <NewScriptCard
            name={newDraft.name}
            body={newDraft.body}
            projects={workspaceProjects}
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
        ) : null}
      </div>
    );
  }

  const hasRail = projects.length > 1;

  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', PANE_RHYTHM.stack)}>
      {topHeading}
      {error !== null && newDraft === null ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex min-h-0 flex-1">
        {hasRail ? (
          <>
            <ProjectRail
              entries={railEntries}
              selectedProjectId={selectedProjectId}
              hasManifestScripts={sessionId != null}
              hasSearch={normalizedQuery !== ''}
              onSelect={(projectId) => onSelectProject({ projectId })}
            />
            <Divider orientation="vertical" />
          </>
        ) : null}
        <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
          <div className={cn('flex flex-col', PANE_RHYTHM.stack, hasRail && PANE_RHYTHM.rail.body)}>
            <header className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="truncate text-base font-semibold text-foreground">
                  {selectedProject.name}
                </h2>
                <p
                  className="truncate font-mono text-2xs text-muted-foreground/70"
                  title={selectedProject.rootPath}
                >
                  {shortenPath({ path: selectedProject.rootPath })}
                </p>
              </div>
              {newScriptAction}
            </header>

            <section className="flex flex-col gap-3" aria-label="Your scripts">
              <SectionHeader
                label="Your scripts"
                headingLevel={3}
                action={
                  <Chip tone="neutral" label={String(selectedUserScripts.length)} size="3xs" />
                }
              />
              {newDraft !== null && newDraft.projectId !== null ? (
                <NewScriptCard
                  name={newDraft.name}
                  body={newDraft.body}
                  projects={workspaceProjects}
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
              ) : null}
              {selectedUserScripts.length === 0 && newDraft === null ? (
                <p className="text-xs text-muted-foreground">
                  {normalizedQuery === ''
                    ? `No scripts for ${selectedProject.name} yet`
                    : 'No matching scripts here'}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {selectedUserScripts.map((script) => {
                    const run = runs?.[script.id] ?? null;
                    const project = projectById.get(script.projectId) ?? null;
                    const projectName = project?.name ?? 'Project';
                    const mountPath = mountByProjectId.get(script.projectId)?.worktreePath ?? null;
                    const runDisabledReason =
                      runnable && mountPath == null
                        ? `${projectName} is not mounted in this session`
                        : null;
                    return (
                      <li key={script.id}>
                        <ScriptRow
                          script={script}
                          projects={workspaceProjects}
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
              )}
            </section>

            {sessionId != null ? (
              <section className="flex flex-col gap-3" aria-label="Manifest scripts">
                <SectionHeader
                  label="Manifest scripts"
                  headingLevel={3}
                  action={
                    <span className="flex items-center gap-2">
                      <Chip tone="neutral" label={String(selectedManifestCount)} size="3xs" />
                      <span className="w-52">
                        <ManifestSearchInput value={searchQuery} onChange={setSearchQuery} />
                      </span>
                      {selectedMount !== null ? (
                        <RefreshIconButton
                          label={`Refresh ${selectedProject.name} manifest scripts`}
                          isLoading={isDiscoveryLoading}
                          onClick={onRefreshDiscovered}
                        />
                      ) : null}
                    </span>
                  }
                />
                {isDiscoveryLoading ? (
                  <p className="text-xs text-muted-foreground">Scanning project manifests…</p>
                ) : null}
                {discoveryError !== null ? (
                  <p className="text-xs text-muted-foreground">{discoveryError}</p>
                ) : null}
                {selectedMount === null ? (
                  <p className="text-xs text-muted-foreground">
                    This project is not mounted in this session.
                  </p>
                ) : null}
                {!isDiscoveryLoading &&
                discoveryError === null &&
                selectedMount !== null &&
                selectedDiscoveredGroups.length === 0 &&
                normalizedQuery === '' ? (
                  <p className="text-xs text-muted-foreground">No manifest scripts found.</p>
                ) : null}
                {normalizedQuery !== '' && !hasSearchResults ? (
                  <div className="flex items-center gap-2 rounded-md bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">
                    <span>No scripts match</span>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-foreground"
                    >
                      Clear
                    </button>
                  </div>
                ) : null}
                {selectedDiscoveredGroups.map((entry) => {
                  const groupKey = `${entry.worktreePath}:${entry.group.source}:${entry.group.relDir}`;
                  const isRoot = entry.group.relDir === '';
                  return (
                    <DiscoveredScriptGroup
                      key={groupKey}
                      group={entry.group}
                      worktreePath={entry.worktreePath}
                      runs={runs}
                      completedAt={completedAt}
                      open={
                        isRoot || normalizedQuery !== '' || (manifestGroupOpen[groupKey] ?? false)
                      }
                      onOpenChange={(open) => {
                        if (isRoot || normalizedQuery !== '') {
                          return;
                        }
                        setManifestGroupOpen((current) => ({ ...current, [groupKey]: open }));
                      }}
                      onRun={onRunDiscovered}
                      onCancel={onCancelDiscovered}
                    />
                  );
                })}
              </section>
            ) : null}
          </div>
        </ScrollFade>
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
