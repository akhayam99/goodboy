import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScriptActionTarget } from '../../../actions/types';
import { Pin, Plus } from 'lucide-react';
import {
  Button,
  EmptyLine,
  EmptyState,
  Notice,
  formatError,
  splitErrorMessage,
  useCopyLink,
  PaneShell,
} from '@goodboy/ui';
import type { MountId, ProjectScriptId, SessionId, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { MountProjectAction } from '../../../session/components/SessionOverviewPane/ProjectMountRows/MountProjectAction';
import type { RunnableScript, SessionScriptGroup } from '../../buildSessionScripts';
import { defaultClosedPackageKeys } from '../../defaultClosedPackageKeys';
import { filterScriptGroups } from '../../filterScriptGroups';
import { groupScriptsByPackage } from '../../groupScriptsByPackage';
import { readCollapsedGroups, writeCollapsedGroups } from '../../groupsCollapsedStorage';
import { useScriptPins } from '../../hooks/useScriptPins';
import { useSessionScripts } from '../../hooks/useSessionScripts';
import { scriptPinId } from '../../scriptPinId';
import { useNow } from '../../../../shared/hooks/useNow';
import {
  readPackagesCollapsedOverrides,
  writePackagesCollapsedOverrides,
} from '../../packagesCollapsedStorage';
import type { ScriptRunRecord } from '../../scripts';
import { startRunnableScript } from '../../startRunnableScript';
import { workspaceInvocation } from '../../workspaceInvocation';
import { ScriptEditor } from '../ScriptEditor';
import { ScriptRow } from '../ScriptRow';
import { DiscardDraftConfirm } from './DiscardDraftConfirm';
import { PinnedScriptsStrip, type PinnedScriptEntry } from './PinnedScriptsStrip';
import { ScriptGroupSection } from './ScriptGroupSection';
import { ScriptPackageSection } from './ScriptPackageSection';
import { ScriptSavedSection } from './ScriptSavedSection';
import { ScriptPinPicker } from './ScriptPinPicker';
import { ScriptsFilterInput } from './ScriptsFilterInput';
import { UnmountedScriptsNote, type UnmountedScriptsEntry } from './UnmountedScriptsNote';
import { useScriptDraft } from './useScriptDraft';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

const packageSectionKey = ({
  mountId,
  sectionKey,
}: {
  readonly mountId: MountId;
  readonly sectionKey: string;
}): string => `${mountId}:${sectionKey}`;

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId;
};

type RowParams = {
  readonly group: SessionScriptGroup;
  readonly script: RunnableScript;
};

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
    const session = sessionById(state.sessions, sessionId);
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
  const toggleScriptPin = useAppStore((state) => state.toggleScriptPin);
  const reportError = useAppStore((state) => state.reportError);

  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<MountId>>(() =>
    readCollapsedGroups({ workspaceId }),
  );
  const [packagesOverrides, setPackagesOverrides] = useState<Readonly<Record<string, boolean>>>(
    () => readPackagesCollapsedOverrides({ workspaceId }),
  );
  const [scopedProjectId] = useState(() => scriptsLensScope?.projectId ?? null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pickerMountId, setPickerMountId] = useState<MountId | null>(null);
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
  const now = useNow(runningCount > 0 ? 1_000 : 30_000);
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
  const pins = useScriptPins({ projectIds: groups.map((group) => group.projectId) });
  const isPinned = ({ group, script }: RowParams): boolean =>
    (pins[group.projectId] ?? []).includes(scriptPinId(script));
  const togglePinId = ({
    group,
    pinId,
  }: {
    readonly group: SessionScriptGroup;
    readonly pinId: string;
  }) =>
    void toggleScriptPin({ projectId: group.projectId, pinId }).catch((error: unknown) =>
      reportError({ title: "Couldn't pin the script", error }),
    );
  const togglePin = ({ group, script }: RowParams) =>
    togglePinId({ group, pinId: scriptPinId(script) });
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

  const setPackageCollapsed = useCallback(
    ({
      mountId,
      sectionKey,
      isCollapsed,
    }: {
      readonly mountId: MountId;
      readonly sectionKey: string;
      readonly isCollapsed: boolean;
    }) => {
      setPackagesOverrides((current) => {
        const next = { ...current, [packageSectionKey({ mountId, sectionKey })]: isCollapsed };
        writePackagesCollapsedOverrides({ workspaceId, overrides: next });
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
    },
    [deleteScript, workspaceId],
  );

  const targetFor = ({ group, script }: RowParams): ScriptActionTarget => {
    const savedId = script.savedId;
    const invocation = workspaceInvocation({
      manager: script.manager,
      packageName: script.packageName,
      relDir: script.relDir,
      name: script.name,
    });
    return {
      kind: 'script',
      facts: {
        name: script.name,
        command: savedId === null ? invocation : script.invocation,
        isRunning: recordFor({ runs, group, script })?.status === 'pending',
        runBlockedReason: group.isReady ? null : `${group.projectName} is still preparing`,
        onShowOutput: () => onOpen({ group, script }),
        onRun: () => onRun({ group, script }),
        onStop: () => onStop({ script }),
        onEdit:
          savedId === null
            ? null
            : () =>
                draft.open({
                  mountId: group.mountId,
                  savedId,
                  projectId: group.projectId,
                  name: script.name,
                  body:
                    saved.find((candidate) => candidate.id === savedId)?.body ?? script.invocation,
                }),
        onDuplicate: savedId === null ? null : () => onDuplicate({ group, script }),
        onSaveAs:
          savedId === null
            ? () =>
                draft.open({
                  mountId: group.mountId,
                  savedId: null,
                  projectId: group.projectId,
                  name: script.name,
                  body: invocation,
                })
            : null,
        onDelete: savedId === null ? null : () => onDelete({ savedId }),
      },
    };
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
    const manifest = discovered?.[group.worktreePath] ?? [];
    const picker =
      pickerMountId === group.mountId && group.isReady ? (
        <ScriptPinPicker
          projectName={group.projectName}
          groups={manifest}
          pins={pins[group.projectId] ?? []}
          onTogglePin={(pinId) => togglePinId({ group, pinId })}
          onClose={() => setPickerMountId(null)}
        />
      ) : null;
    if (group.scripts.length > 0) {
      return picker;
    }
    if (!group.isReady) {
      return (
        <p className="px-2 py-2 text-label text-faint-foreground">
          {group.projectName} is still preparing.
        </p>
      );
    }
    const scan = scans?.[group.worktreePath];
    if (scan?.status === 'error') {
      const { summary, detail } = splitErrorMessage({ message: scan.error ?? '' });
      return (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title={`Couldn't read the scripts of ${group.projectName}`}
          body={summary ?? 'Goodboy could not read this project.'}
          detail={detail}
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                void refreshDiscoveredScripts({ sessionId, worktreePath: group.worktreePath })
              }
            >
              Retry
            </Button>
          }
        />
      );
    }
    if (discovered?.[group.worktreePath] === undefined) {
      return (
        <p className="px-2 py-2 text-label text-faint-foreground">
          Reading scripts in {group.projectName}…
        </p>
      );
    }
    if (draft.draft?.mountId === group.mountId) {
      return null;
    }
    const hasManifestScripts = manifest.some((entry) => entry.scripts.length > 0);
    return (
      <>
        <EmptyState
          size="section"
          className="px-2"
          icon={CONCEPT_ICONS.scripts}
          title={`No scripts in ${group.projectName}`}
          action={
            <div className="flex items-center gap-2">
              {hasManifestScripts ? (
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={`Pin a script of ${group.projectName}`}
                  aria-expanded={picker !== null}
                  onClick={() => setPickerMountId(picker === null ? group.mountId : null)}
                >
                  <Pin size={ICON_SIZE.row} aria-hidden />
                  Pin a script
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="xs"
                aria-label={`New script in ${group.projectName}`}
                onClick={() => openNew({ group })}
              >
                <Plus size={ICON_SIZE.row} aria-hidden />
                New script
              </Button>
            </div>
          }
        />
        {picker}
      </>
    );
  };

  const renderRow = ({ group, script }: RowParams, showSource: boolean) => {
    const isEditing =
      script.savedId !== null &&
      draft.draft?.savedId === script.savedId &&
      draft.draft.mountId === group.mountId;
    if (isEditing) {
      return <div key={script.key}>{editorNode}</div>;
    }
    return (
      <ScriptRow
        key={script.key}
        script={script}
        record={recordFor({ runs, group, script })}
        now={now}
        showSource={showSource}
        isSelected={
          openPayload !== null &&
          openPayload.scriptKey === script.key &&
          (openPayload.mountId === null || openPayload.mountId === group.mountId)
        }
        blockedReason={group.isReady ? null : `${group.projectName} is still preparing`}
        target={targetFor({ group, script })}
        isPinned={isPinned({ group, script })}
        onTogglePin={() => togglePin({ group, script })}
        onOpen={() => onOpen({ group, script })}
        onRun={() => onRun({ group, script })}
        onStop={() => onStop({ script })}
      />
    );
  };

  const renderScripts = ({ group }: { readonly group: SessionScriptGroup }) => {
    if (group.packageCount < 2) {
      return group.scripts.map((script) => renderRow({ group, script }, true));
    }
    const sections = groupScriptsByPackage({ scripts: group.scripts });
    const isSearching = query.trim() !== '';
    const startedAtByKey: Record<string, number> = {};
    const runningKeys = new Set<string>();
    for (const script of group.scripts) {
      const record = recordFor({ runs, group, script });
      if (record === null) {
        continue;
      }
      startedAtByKey[script.key] = record.startedAt;
      if (record.status === 'pending') {
        runningKeys.add(script.key);
      }
    }
    const defaultClosed = defaultClosedPackageKeys({
      sections,
      packageCount: group.packageCount,
      runningKeys,
      startedAtByKey,
      now,
    });
    return (
      <div className="flex flex-col gap-2">
        {sections.map((section) => {
          const rows = section.scripts.map((script) => renderRow({ group, script }, false));
          if (section.source === 'saved') {
            return (
              <ScriptSavedSection key={section.key} count={section.scripts.length}>
                {rows}
              </ScriptSavedSection>
            );
          }
          const overrideKey = packageSectionKey({
            mountId: group.mountId,
            sectionKey: section.key,
          });
          const isCollapsed = isSearching
            ? false
            : (packagesOverrides[overrideKey] ?? defaultClosed.has(section.key));
          const runningInSection = section.scripts.filter((script) =>
            runningKeys.has(script.key),
          ).length;
          return (
            <ScriptPackageSection
              key={section.key}
              section={section}
              isCollapsed={isCollapsed}
              runningCount={runningInSection}
              onToggle={() =>
                setPackageCollapsed({
                  mountId: group.mountId,
                  sectionKey: section.key,
                  isCollapsed: !isCollapsed,
                })
              }
            >
              {rows}
            </ScriptPackageSection>
          );
        })}
      </div>
    );
  };

  const seenPins = new Set<string>();
  const pinnedEntries: ReadonlyArray<PinnedScriptEntry> = groups.flatMap((group) =>
    group.scripts
      .filter((script) => isPinned({ group, script }))
      .filter((script) => {
        const seenKey = `${group.projectId}:${scriptPinId(script)}`;
        if (seenPins.has(seenKey)) {
          return false;
        }
        seenPins.add(seenKey);
        return true;
      })
      .map((script) => ({
        key: `${group.mountId}:${script.key}`,
        name: script.name,
        projectName: group.projectName,
        isRunning: recordFor({ runs, group, script })?.status === 'pending',
        blockedReason: group.isReady ? null : `${group.projectName} is still preparing`,
        onRun: () => onRun({ group, script }),
      })),
  );

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
    <PaneShell title="Scripts" meta={groups.length === 0 ? undefined : meta} actions={actions}>
      {groups.length === 0 ? (
        <EmptyState
          size="page"
          icon={CONCEPT_ICONS.scripts}
          title="No scripts yet"
          description="Scripts run inside a project of this session."
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
      {projectCount < 2 ? null : <PinnedScriptsStrip entries={pinnedEntries} />}
      {query.trim() !== '' && visibleGroups.length === 0 ? (
        <EmptyLine
          action={
            <Button variant="ghost" size="xs" onClick={() => setQuery('')}>
              Clear filter
            </Button>
          }
        >
          No scripts match "{query.trim()}".
        </EmptyLine>
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
                {renderScripts({ group })}
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
