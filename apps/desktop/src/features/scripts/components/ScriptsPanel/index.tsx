import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  InlineConfirm,
  LensEmptyState,
  formatError,
  useCopyLink,
  type OverflowMenuItem,
} from '@goodboy/ui';
import type { MountId, ProjectScriptId, SessionId, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { MountProjectAction } from '../../../session/components/SessionOverviewPane/ProjectMountRows/MountProjectAction';
import type { RunnableScript, SessionScriptGroup } from '../../buildSessionScripts';
import { filterScriptGroups } from '../../filterScriptGroups';
import { readCollapsedGroups, writeCollapsedGroups } from '../../groupsCollapsedStorage';
import { useSessionScripts } from '../../hooks/useSessionScripts';
import type { ScriptRunRecord } from '../../scripts';
import { startRunnableScript } from '../../startRunnableScript';
import { ScriptEditor } from '../ScriptEditor';
import { ScriptRow } from '../ScriptRow';
import { DiscardDraftConfirm } from './DiscardDraftConfirm';
import { ScriptGroupSection } from './ScriptGroupSection';
import { ScriptsFilterInput } from './ScriptsFilterInput';
import { UnmountedScriptsNote, type UnmountedScriptsEntry } from './UnmountedScriptsNote';
import { useScriptDraft } from './useScriptDraft';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId;
};

type RowParams = {
  readonly group: SessionScriptGroup;
  readonly script: RunnableScript;
};

type ArmedDelete = {
  readonly savedId: ProjectScriptId;
  readonly mountId: MountId;
};

const RUNNING_TICK_MS = 1_000;
const IDLE_TICK_MS = 30_000;

type RecordParams = {
  readonly runs: Readonly<Record<string, ScriptRunRecord>> | undefined;
  readonly group: SessionScriptGroup;
  readonly script: RunnableScript;
};

const recordFor = ({ runs, group, script }: RecordParams): ScriptRunRecord | null => {
  const record = runs?.[script.key] ?? null;
  if (record === null || record.mountId === undefined) {
    return record;
  }
  return record.mountId === group.mountId ? record : null;
};

const plural = ({ count, word }: { readonly count: number; readonly word: string }) =>
  `${count} ${count === 1 ? word : `${word}s`}`;

export const ScriptsPanel = ({ workspaceId, sessionId }: Props) => {
  const { groups } = useSessionScripts({ sessionId, workspaceId, shouldScan: true });
  const saved = useAppStore((state) => state.projectScripts[workspaceId] ?? EMPTY_ARRAY);
  const allProjects = useAppStore((state) => state.projects);
  const runs = useAppStore((state) => state.scriptRuns[sessionId]);
  const discovered = useAppStore((state) => state.discoveredScripts[sessionId]);
  const scans = useAppStore((state) => state.discoveredScriptScans[sessionId]);
  const activeProjectId = useAppStore((state) => {
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    return state.sessionActiveProject[sessionId] ?? session?.activeProjectId ?? null;
  });
  const openPayload = useAppStore((state) => {
    const drawer = selectOpenDrawer(state);
    return drawer?.kind === 'scriptRun' && drawer.sessionId === sessionId ? drawer.payload : null;
  });
  const scriptsLensScope = useAppStore((state) => state.scriptsLensScope);
  const setScriptsLensScope = useAppStore((state) => state.setScriptsLensScope);
  const loadScripts = useAppStore((state) => state.loadScripts);
  const saveScript = useAppStore((state) => state.saveScript);
  const deleteScript = useAppStore((state) => state.deleteScript);
  const cancelScript = useAppStore((state) => state.cancelScript);
  const refreshDiscoveredScripts = useAppStore((state) => state.refreshDiscoveredScripts);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const toggleDrawer = useAppStore((state) => state.toggleDrawer);

  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<MountId>>(() =>
    readCollapsedGroups({ workspaceId }),
  );
  const [scopedProjectId] = useState(() => scriptsLensScope?.projectId ?? null);
  const [armedDelete, setArmedDelete] = useState<ArmedDelete | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const draft = useScriptDraft({ workspaceId });
  const { copy } = useCopyLink();

  const workspaceProjects = useMemo(
    () => allProjects.filter((project) => project.workspaceId === workspaceId),
    [allProjects, workspaceId],
  );
  const visibleGroups = useMemo(() => filterScriptGroups({ groups, query }), [groups, query]);
  const runningCount = useMemo(
    () => Object.values(runs ?? {}).filter((record) => record.status === 'pending').length,
    [runs],
  );
  const projectCount = useMemo(
    () => new Set(groups.map((group) => group.projectId)).size,
    [groups],
  );
  const unmounted = useMemo<ReadonlyArray<UnmountedScriptsEntry>>(() => {
    const mounted = new Set(groups.map((group) => group.projectId));
    return workspaceProjects.flatMap((project) => {
      if (mounted.has(project.id)) {
        return [];
      }
      const count = saved.filter((script) => script.projectId === project.id).length;
      return count === 0 ? [] : [{ projectName: project.name, count }];
    });
  }, [groups, saved, workspaceProjects]);
  const activeGroup =
    groups.find((group) => group.projectId === scopedProjectId) ??
    groups.find((group) => group.projectId === activeProjectId) ??
    groups[0] ??
    null;

  useEffect(() => {
    void loadScripts(workspaceId);
  }, [loadScripts, workspaceId]);

  useEffect(() => {
    setScriptsLensScope({ scope: null });
  }, [setScriptsLensScope]);

  useEffect(() => {
    const id = window.setInterval(
      () => setNow(Date.now()),
      runningCount > 0 ? RUNNING_TICK_MS : IDLE_TICK_MS,
    );
    return () => window.clearInterval(id);
  }, [runningCount]);

  const setGroupCollapsed = useCallback(
    ({ mountId, isCollapsed }: { readonly mountId: MountId; readonly isCollapsed: boolean }) => {
      setCollapsed((current) => {
        const next = new Set(current);
        if (isCollapsed) {
          next.add(mountId);
        } else {
          next.delete(mountId);
        }
        writeCollapsedGroups({ workspaceId, collapsed: next });
        return next;
      });
    },
    [workspaceId],
  );

  const openNew = useCallback(
    ({ group }: { readonly group: SessionScriptGroup }) => {
      setGroupCollapsed({ mountId: group.mountId, isCollapsed: false });
      draft.open({
        mountId: group.mountId,
        savedId: null,
        projectId: group.projectId,
        name: '',
        body: '',
      });
    },
    [draft, setGroupCollapsed],
  );

  const onOpen = useCallback(
    ({ group, script }: RowParams) => {
      toggleDrawer({
        kind: 'scriptRun',
        sessionId,
        payload: { scriptKey: script.key, mountId: group.mountId },
      });
    },
    [sessionId, toggleDrawer],
  );

  const onRun = useCallback(
    ({ group, script }: RowParams) => {
      openDrawer({
        kind: 'scriptRun',
        sessionId,
        payload: { scriptKey: script.key, mountId: group.mountId },
      });
      void startRunnableScript({
        sessionId,
        script,
        mountId: group.mountId,
        worktreePath: group.worktreePath,
      });
    },
    [openDrawer, sessionId],
  );

  const onStop = useCallback(
    ({ script }: { readonly script: RunnableScript }) => {
      void cancelScript(sessionId, script.key);
    },
    [cancelScript, sessionId],
  );

  const onDuplicate = useCallback(
    ({ group, script }: RowParams) => {
      const body = saved.find((candidate) => candidate.id === script.savedId)?.body ?? '';
      saveScript({
        workspaceId,
        projectId: group.projectId,
        name: `${script.name} copy`,
        body,
      }).catch((caughtError: unknown) => setPageError(formatError(caughtError)));
    },
    [saveScript, saved, workspaceId],
  );

  const onDelete = useCallback(
    async ({ savedId }: { readonly savedId: ProjectScriptId }) => {
      try {
        await deleteScript(savedId, workspaceId);
        setPageError(null);
      } catch (caughtError) {
        setPageError(formatError(caughtError));
      }
      setArmedDelete(null);
    },
    [deleteScript, workspaceId],
  );

  const menuItemsFor = ({ group, script }: RowParams): ReadonlyArray<OverflowMenuItem> => {
    const savedId = script.savedId;
    if (savedId === null) {
      return [
        {
          kind: 'item',
          key: 'save-as',
          label: 'Save as script',
          onClick: () =>
            draft.open({
              mountId: group.mountId,
              savedId: null,
              projectId: group.projectId,
              name: script.name,
              body: script.command,
            }),
        },
        {
          kind: 'item',
          key: 'copy',
          label: 'Copy command',
          onClick: () => void copy({ text: script.command, key: script.key }),
        },
      ];
    }
    return [
      {
        kind: 'item',
        key: 'edit',
        label: 'Edit',
        onClick: () =>
          draft.open({
            mountId: group.mountId,
            savedId,
            projectId: group.projectId,
            name: script.name,
            body: saved.find((candidate) => candidate.id === savedId)?.body ?? script.command,
          }),
      },
      {
        kind: 'item',
        key: 'duplicate',
        label: 'Duplicate',
        onClick: () => onDuplicate({ group, script }),
      },
      {
        kind: 'item',
        key: 'delete',
        label: 'Delete',
        destructive: true,
        onClick: () => setArmedDelete({ savedId, mountId: group.mountId }),
      },
    ];
  };

  const editorNode =
    draft.draft === null ? null : (
      <ScriptEditor
        label={draft.draft.savedId === null ? 'New script' : `Edit ${draft.draft.initialName}`}
        name={draft.draft.name}
        body={draft.draft.body}
        projects={workspaceProjects}
        projectId={draft.draft.projectId}
        error={draft.error}
        isSaving={draft.isSaving}
        onNameChange={(name) => draft.update({ name })}
        onBodyChange={(body) => draft.update({ body })}
        onProjectChange={(projectId) => draft.update({ projectId })}
        onSave={draft.save}
        onCancel={draft.cancel}
      />
    );

  const groupNote = ({ group }: { readonly group: SessionScriptGroup }) => {
    if (group.scripts.length > 0) {
      return null;
    }
    if (!group.isReady) {
      return (
        <p className="px-2 py-1.5 text-label text-faint-foreground">
          {group.projectName} is still preparing.
        </p>
      );
    }
    const scan = scans?.[group.worktreePath];
    if (scan?.status === 'error') {
      return <p className="px-2 py-1.5 text-label text-faint-foreground">{scan.error}</p>;
    }
    if (discovered?.[group.worktreePath] === undefined) {
      return (
        <p className="px-2 py-1.5 text-label text-faint-foreground">
          Reading scripts in {group.projectName}…
        </p>
      );
    }
    if (draft.draft?.mountId === group.mountId) {
      return null;
    }
    return (
      <div className="flex items-center gap-2 px-2 py-1">
        <p className="min-w-0 flex-1 text-label text-faint-foreground">
          No package.json or composer.json in {group.projectName}.
        </p>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`New script in ${group.projectName}`}
          onClick={() => openNew({ group })}
        >
          <Plus size={ICON_SIZE.row} aria-hidden />
          New script
        </Button>
      </div>
    );
  };

  const renderRow = ({ group, script }: RowParams) => {
    const isEditing =
      script.savedId !== null &&
      draft.draft?.savedId === script.savedId &&
      draft.draft.mountId === group.mountId;
    if (isEditing) {
      return <div key={script.key}>{editorNode}</div>;
    }
    const isArmed =
      script.savedId !== null &&
      armedDelete?.savedId === script.savedId &&
      armedDelete.mountId === group.mountId;
    if (isArmed && script.savedId !== null) {
      const savedId = script.savedId;
      return (
        <InlineConfirm
          key={script.key}
          role="danger"
          icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
          title={`Delete "${script.name}"?`}
          description="Removes it from every session of this workspace."
          confirmLabel="Delete"
          autoDisarmMs={4000}
          onConfirm={() => onDelete({ savedId })}
          onCancel={() => setArmedDelete(null)}
        />
      );
    }
    return (
      <ScriptRow
        key={script.key}
        script={script}
        record={recordFor({ runs, group, script })}
        now={now}
        isSelected={
          openPayload !== null &&
          openPayload.scriptKey === script.key &&
          (openPayload.mountId === null || openPayload.mountId === group.mountId)
        }
        blockedReason={group.isReady ? null : `${group.projectName} is still preparing`}
        menuItems={menuItemsFor({ group, script })}
        onOpen={() => onOpen({ group, script })}
        onRun={() => onRun({ group, script })}
        onStop={() => onStop({ script })}
      />
    );
  };

  const meta = [
    plural({ count: projectCount, word: 'project' }),
    runningCount > 0 ? `${runningCount} running` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

  const actions =
    groups.length === 0 ? null : (
      <div className="flex items-center gap-2">
        <ScriptsFilterInput value={query} onChange={setQuery} />
        {activeGroup === null ? null : (
          <Button variant="secondary" size="sm" onClick={() => openNew({ group: activeGroup })}>
            <Plus size={ICON_SIZE.row} aria-hidden />
            New script
          </Button>
        )}
      </div>
    );

  return (
    <PaneShell
      title="Scripts"
      icon={CONCEPT_ICONS.scripts}
      tone={CONCEPT_TONE.scripts}
      meta={groups.length === 0 ? undefined : meta}
      actions={actions}
    >
      {groups.length === 0 ? (
        <LensEmptyState
          tone={CONCEPT_TONE.scripts}
          icon={CONCEPT_ICONS.scripts}
          title="Scripts run inside a project of this session."
          description="Goodboy reads package.json and composer.json from each project, and keeps the scripts you save."
          action={
            <MountProjectAction
              sessionId={sessionId}
              workspaceId={workspaceId}
              presentation="button"
            />
          }
        />
      ) : null}
      {pageError === null ? null : (
        <p role="alert" className="text-label text-danger">
          {pageError}
        </p>
      )}
      {draft.hasPending ? (
        <DiscardDraftConfirm
          onSave={draft.saveAndContinue}
          onDiscard={draft.discardAndContinue}
          onCancel={draft.keepEditing}
        />
      ) : null}
      {query.trim() !== '' && visibleGroups.length === 0 ? (
        <p className="text-label text-muted-foreground">No scripts match "{query.trim()}".</p>
      ) : null}
      {visibleGroups.length > 0 ? (
        <div className="flex flex-col gap-4">
          {visibleGroups.map((group) => {
            const isCollapsed = query.trim() === '' && collapsed.has(group.mountId);
            const isNewHere =
              draft.draft?.savedId === null && draft.draft.mountId === group.mountId;
            return (
              <ScriptGroupSection
                key={group.mountId}
                group={group}
                count={group.scripts.length}
                isCollapsed={isCollapsed}
                isRefreshing={scans?.[group.worktreePath]?.status === 'loading'}
                editor={isNewHere ? editorNode : null}
                note={groupNote({ group })}
                onToggle={() =>
                  setGroupCollapsed({ mountId: group.mountId, isCollapsed: !isCollapsed })
                }
                onRefresh={() =>
                  void refreshDiscoveredScripts({ sessionId, worktreePath: group.worktreePath })
                }
              >
                {group.scripts.map((script) => renderRow({ group, script }))}
              </ScriptGroupSection>
            );
          })}
        </div>
      ) : null}
      {unmounted.length === 0 ? null : (
        <UnmountedScriptsNote
          sessionId={sessionId}
          workspaceId={workspaceId}
          entries={unmounted}
          hasAction={groups.length > 0}
        />
      )}
    </PaneShell>
  );
};
