import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScriptActionTarget } from '../../../actions/types';
import { Pin, Plus } from '@goodboy/ui/icons';
import {
  Button,
  DrawerFrame,
  EmptyLine,
  ErrorStrip,
  ICON_SIZE,
  IconButton,
  SkeletonRow,
  useCopyLink,
} from '@goodboy/ui';
import type { MountId, SessionId, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { deleteSavedScript } from '../../deleteSavedScript';
import { duplicateScript } from '../../duplicateScript';
import { scriptsScopeOf } from '../../scriptsScopeOf';
import { MountProjectAction } from '../../../session/components/SessionOverviewPane/ProjectMountRows/MountProjectAction';
import type { RunnableScript, SessionScriptGroup } from '../../buildSessionScripts';
import { isService } from '../../classifyScript';
import { defaultClosedPackageKeys } from '../../defaultClosedPackageKeys';
import { filterScriptGroups } from '../../filterScriptGroups';
import { groupScriptsByPackage } from '../../groupScriptsByPackage';
import { useScriptKeys } from '../../hooks/useScriptKeys';
import { useScriptLive } from '../../hooks/useScriptLive';
import { useServiceStarts } from '../../hooks/useServiceStarts';
import { useSessionScripts } from '../../hooks/useSessionScripts';
import { isScriptOpenIn } from '../../isScriptOpenIn';
import { useNow } from '../../../../shared/hooks/useNow';
import { openScriptInTerminal } from '../../openScriptInTerminal';
import { scriptGroupScopeOf } from '../../scriptGroupScopeOf';
import { scriptRunRecordFor } from '../../scriptRunRecordFor';
import { scriptOutcomeLabel } from '../../scriptOutcomeLabel';
import { scriptRecordOutput } from '../../scriptRecordOutput';
import { startRunnableScript } from '../../startRunnableScript';
import { stopScriptRun } from '../../stopScriptRun';
import {
  NO_OUTPUT_REASON,
  useHandOutputToAgent,
} from '../../../../shared/hooks/useHandOutputToAgent';
import { workspaceInvocation } from '../../workspaceInvocation';
import { ScriptEditor } from '../ScriptEditor';
import { ScriptRow } from '../ScriptRow';
import { DiscardDraftConfirm } from './DiscardDraftConfirm';
import { EndedServicesRow } from './EndedServicesRow';
import { ScriptGroupSection } from './ScriptGroupSection';
import { ScriptPackageSection } from './ScriptPackageSection';
import { ScriptSavedSection } from './ScriptSavedSection';
import { SuggestedBand } from './SuggestedBand';
import { ScriptPinPicker } from './ScriptPinPicker';
import { StartAllServices } from './StartAllServices';
import { ScriptsFilterInput } from './ScriptsFilterInput';
import { UnmountedScriptsNote } from './UnmountedScriptsNote';
import { packageSectionKey } from './packageSectionKey';
import { unmountedScriptsOf } from './unmountedScriptsOf';
import { useScriptCollapse } from './useScriptCollapse';
import { useScriptDraft } from './useScriptDraft';
import { useScriptPinActions } from './useScriptPinActions';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId;
  readonly onClose: () => void;
};

const FILTER_FROM_ROWS = 9;

type SuggestedParams = {
  readonly group: SessionScriptGroup;
  readonly hasManifestScripts: boolean;
};

type GroupParams = {
  readonly group: SessionScriptGroup;
};

type RowParams = {
  readonly group: SessionScriptGroup;
  readonly script: RunnableScript;
};

export const ScriptsPanel = ({ workspaceId, sessionId, onClose }: Props) => {
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
  const scopeProjectId = useAppStore((state) => scriptsScopeOf({ state, sessionId }));
  const loadScripts = useAppStore((state) => state.loadScripts);
  const refreshDiscoveredScripts = useAppStore((state) => state.refreshDiscoveredScripts);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const toggleDrawer = useAppStore((state) => state.toggleDrawer);

  const [query, setQuery] = useState('');
  const { collapsed, packagesOverrides, setGroupCollapsed, setPackageCollapsed } =
    useScriptCollapse({ workspaceId });
  const [scopedProjectId] = useState(() => scopeProjectId);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [pickerMountId, setPickerMountId] = useState<MountId | null>(null);
  const draft = useScriptDraft({ workspaceId });
  const { copy } = useCopyLink();
  const handOutput = useHandOutputToAgent({ sessionId });

  const workspaceProjects = useMemo(
    () => allProjects.filter((project) => project.workspaceId === workspaceId),
    [allProjects, workspaceId],
  );
  const visibleGroups = useMemo(() => filterScriptGroups({ groups, query }), [groups, query]);
  const rowCount = groups.reduce(
    (total, group) => total + group.scripts.length + group.suggested.length,
    0,
  );
  const live = useScriptLive({ runs });
  const runningCount = useMemo(
    () => Object.values(runs ?? {}).filter((record) => record.status === 'pending').length,
    [runs],
  );
  const now = useNow(runningCount > 0 ? 1_000 : 30_000);
  const unmounted = useMemo(
    () => unmountedScriptsOf({ groups, saved, projects: workspaceProjects }),
    [groups, saved, workspaceProjects],
  );
  const { pins, isPinned, togglePinId, togglePin } = useScriptPinActions({ groups });
  const activeGroup =
    groups.find((group) => group.projectId === scopedProjectId) ??
    groups.find((group) => group.projectId === activeProjectId) ??
    groups[0] ??
    null;

  useEffect(() => {
    void loadScripts(workspaceId);
  }, [loadScripts, workspaceId]);

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
        payload: { scriptKey: script.key, mountId: group.mountId, from: 'scripts' },
      });
    },
    [sessionId, toggleDrawer],
  );

  const onRun = useCallback(
    ({ group, script }: RowParams) => {
      if (!isService({ script })) {
        openDrawer({
          kind: 'scriptRun',
          sessionId,
          payload: { scriptKey: script.key, mountId: group.mountId, from: 'scripts' },
        });
      }
      void startRunnableScript({
        sessionId,
        script,
        mountId: group.mountId,
        worktreePath: group.worktreePath,
      });
    },
    [openDrawer, sessionId],
  );

  const { onStartAll, ended } = useServiceStarts({ sessionId, groups, runs, onRun });

  const onStop = useCallback(
    ({ script }: { readonly script: RunnableScript }) =>
      void stopScriptRun({ sessionId, scriptKey: script.key }),
    [sessionId],
  );

  const onRestart = useCallback(
    async ({ group, script }: RowParams) => {
      if (await stopScriptRun({ sessionId, scriptKey: script.key })) {
        onRun({ group, script });
      }
    },
    [onRun, sessionId],
  );

  const onDuplicate = ({ group, script }: RowParams) => {
    const body = saved.find((candidate) => candidate.id === script.savedId)?.body ?? '';
    const { projectId } = group;
    void duplicateScript({ workspaceId, sessionId, projectId, name: script.name, body });
  };

  const targetFor = ({ group, script }: RowParams): ScriptActionTarget => {
    const savedId = script.savedId;
    const invocation = workspaceInvocation({
      manager: script.manager,
      packageName: script.packageName,
      relDir: script.relDir,
      name: script.name,
    });
    const record = scriptRunRecordFor({ runs, group, script });
    const output = scriptRecordOutput({ record });
    return {
      kind: 'script',
      facts: {
        name: script.name,
        command: savedId === null ? invocation : script.invocation,
        isRunning: scriptRunRecordFor({ runs, group, script })?.status === 'pending',
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
        onDelete:
          savedId === null
            ? null
            : async () => {
                await deleteSavedScript({ workspaceId, sessionId, savedId, name: script.name });
              },
        onRestart: () => void onRestart({ group, script }),
        ...(group.isReady && {
          onOpenInTerminal: () =>
            openScriptInTerminal({
              sessionId,
              group,
              script,
              savedBody: saved.find((candidate) => candidate.id === savedId)?.body ?? null,
            }),
        }),
        pin: {
          isPinned: isPinned({ group, script }),
          onToggle: () => togglePin({ group, script }),
        },
        ...(handOutput.canHandOff && {
          ask: {
            label: handOutput.askLabel,
            blockedReason: output === '' ? NO_OUTPUT_REASON : null,
            onAsk: () =>
              handOutput.handOff({
                subject: script.name,
                outcome: scriptOutcomeLabel({
                  status: record?.status ?? 'idle',
                  exitCode: record?.result?.exitCode ?? null,
                }),
                projectName: group.projectName,
                branch: group.branch === '' ? null : group.branch,
                output,
              }),
          },
        }),
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
    if (group.scripts.length > 0 || group.suggested.length > 0) {
      return picker;
    }
    if (!group.isReady) {
      return (
        <p className="px-2 py-2 text-meta text-faint-foreground">
          {group.projectName} is still preparing.
        </p>
      );
    }
    const scan = scans?.[group.worktreePath];
    if (scan?.status === 'error') {
      return (
        <ErrorStrip
          labels={[`the scripts of ${group.projectName}`]}
          error={new Error(scan.error ?? '')}
          onRetry={() =>
            void refreshDiscoveredScripts({ sessionId, worktreePath: group.worktreePath })
          }
        />
      );
    }
    if (discovered?.[group.worktreePath] === undefined) {
      return <SkeletonRow label={`Loading scripts in ${group.projectName}`} />;
    }
    if (draft.draft?.mountId === group.mountId) {
      return null;
    }
    const hasManifestScripts = manifest.some((entry) => entry.scripts.length > 0);
    return (
      <>
        <EmptyLine
          className="px-2"
          action={
            <span className="flex items-center gap-1">
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
            </span>
          }
        >
          No scripts in {group.projectName}
        </EmptyLine>
        {picker}
      </>
    );
  };

  const orderedKeys: string[] = [];
  const rowsByKey = new Map<string, RowParams>();

  const registerRow = ({ group, script }: RowParams): string => {
    const rowKey = `${group.mountId}:${script.key}`;
    orderedKeys.push(rowKey);
    rowsByKey.set(rowKey, { group, script });
    return rowKey;
  };

  const renderRow = ({ group, script }: RowParams) => {
    const isEditing =
      script.savedId !== null &&
      draft.draft?.savedId === script.savedId &&
      draft.draft.mountId === group.mountId;
    if (isEditing) {
      return <div key={script.key}>{editorNode}</div>;
    }
    const rowKey = registerRow({ group, script });
    const record = scriptRunRecordFor({ runs, group, script });
    const projectId = group.projectId;
    const port =
      isService({ script }) && script.kind === 'manifest'
        ? live.expectedPortOf({ projectId, scriptName: script.name, relDir: script.relDir })
        : null;
    const facts = record === null ? null : (live.factsByRunId[record.runId] ?? null);
    const isOwnPort = facts !== null && port !== null && facts.ports.includes(port);
    return (
      <ScriptRow
        key={script.key}
        script={script}
        record={record}
        now={now}
        expectedPort={port}
        portHolder={
          port === null || isOwnPort
            ? null
            : live.holderOf({ port, worktreePath: group.worktreePath })
        }
        facts={facts}
        isSelected={focusedKey === rowKey || isScriptOpenIn({ openPayload, group, script })}
        blockedReason={group.isReady ? null : `${group.projectName} is still preparing`}
        target={targetFor({ group, script })}
        onOpen={() => onOpen({ group, script })}
        onRun={() => onRun({ group, script })}
        onStop={() => onStop({ script })}
      />
    );
  };

  const renderScripts = ({
    group,
    scripts,
    band,
  }: {
    readonly group: SessionScriptGroup;
    readonly scripts: ReadonlyArray<RunnableScript>;
    readonly band: 'services' | 'tasks';
  }) => {
    if (group.packageCount < 2) {
      return scripts.map((script) => renderRow({ group, script }));
    }
    const sections = groupScriptsByPackage({ scripts });
    const isSearching = query.trim() !== '';
    const startedAtByKey: Record<string, number> = {};
    const runningKeys = new Set<string>();
    for (const script of scripts) {
      const record = scriptRunRecordFor({ runs, group, script });
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
          const rows = section.scripts.map((script) => renderRow({ group, script }));
          if (section.source === 'saved') {
            return (
              <ScriptSavedSection key={section.key} count={section.scripts.length}>
                {rows}
              </ScriptSavedSection>
            );
          }
          const overrideKey = packageSectionKey({
            mountId: group.mountId,
            sectionKey: `${band}:${section.key}`,
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
                  sectionKey: `${band}:${section.key}`,
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

  const renderSuggested = ({ group, hasManifestScripts }: SuggestedParams) => {
    if (group.suggested.length === 0 || pickerMountId === group.mountId) {
      return null;
    }
    for (const script of group.suggested) {
      registerRow({ group, script });
    }
    return (
      <SuggestedBand
        group={group}
        runs={runs}
        canPick={hasManifestScripts && group.isReady}
        isPickerOpen={pickerMountId === group.mountId}
        onTogglePicker={() =>
          setPickerMountId(pickerMountId === group.mountId ? null : group.mountId)
        }
        isScriptSelected={(script) =>
          focusedKey === `${group.mountId}:${script.key}` ||
          isScriptOpenIn({ openPayload, group, script })
        }
        onOpen={(script) => onOpen({ group, script })}
        onRun={(script) => onRun({ group, script })}
        onStop={(script) => onStop({ script })}
        onPin={(script) => togglePin({ group, script })}
      />
    );
  };

  const startAllOf = ({ group }: GroupParams) => {
    const services = group.scripts.filter((script) => isService({ script }));
    return services.length > 1 && group.isReady && query.trim() === '' ? (
      <StartAllServices group={group} services={services} runs={runs} onStart={onStartAll} />
    ) : null;
  };

  const renderGroupBands = ({ group }: GroupParams) => {
    const services = group.scripts.filter((script) => isService({ script }));
    const tasks = group.scripts.filter((script) => !isService({ script }));
    const hasManifestScripts = (discovered?.[group.worktreePath] ?? []).some(
      (entry) => entry.scripts.length > 0,
    );
    return (
      <>
        {group.scripts.length === 0 ? null : (
          <section
            aria-label={`Scripts of ${scriptGroupScopeOf({ group })}`}
            className="flex flex-col gap-0.5"
          >
            {renderScripts({ group, scripts: services, band: 'services' })}
            {renderScripts({ group, scripts: tasks, band: 'tasks' })}
          </section>
        )}
        {renderSuggested({ group, hasManifestScripts })}
      </>
    );
  };

  const newScriptAction =
    groups.length === 0 || activeGroup === null ? null : (
      <DiscardDraftConfirm
        isOpen={draft.hasPending}
        onSave={draft.saveAndContinue}
        onDiscard={draft.discardAndContinue}
        onCancel={draft.keepEditing}
        trigger={() => (
          <IconButton
            icon={Plus}
            label="New script"
            tooltip="New script"
            variant="ghost"
            iconSize={ICON_SIZE.control}
            onClick={() => openNew({ group: activeGroup })}
          />
        )}
      />
    );

  const groupsNode =
    visibleGroups.length > 0 ? (
      <div className="flex flex-col gap-4">
        {visibleGroups.map((group) => {
          const isCollapsed = query.trim() === '' && collapsed.has(group.mountId);
          const isNewHere = draft.draft?.savedId === null && draft.draft.mountId === group.mountId;
          return (
            <ScriptGroupSection
              key={group.mountId}
              group={group}
              isCollapsed={isCollapsed}
              isRefreshing={scans?.[group.worktreePath]?.status === 'loading'}
              editor={isNewHere ? editorNode : null}
              note={groupNote({ group })}
              action={startAllOf({ group })}
              onToggle={() =>
                setGroupCollapsed({ mountId: group.mountId, isCollapsed: !isCollapsed })
              }
              onRefresh={() =>
                void refreshDiscoveredScripts({ sessionId, worktreePath: group.worktreePath })
              }
            >
              {renderGroupBands({ group })}
            </ScriptGroupSection>
          );
        })}
      </div>
    ) : null;

  useScriptKeys({
    keys: orderedKeys,
    selectedKey: focusedKey,
    onSelect: setFocusedKey,
    onOpen: (key) => {
      const row = rowsByKey.get(key);
      if (row !== undefined) {
        onOpen(row);
      }
    },
    onRun: (key) => {
      const row = rowsByKey.get(key);
      if (row === undefined) {
        return;
      }
      if (scriptRunRecordFor({ runs, ...row })?.status === 'pending') {
        void onRestart(row);
        return;
      }
      onRun(row);
    },
    onStop: (key) => {
      const row = rowsByKey.get(key);
      if (row !== undefined && scriptRunRecordFor({ runs, ...row })?.status === 'pending') {
        onStop({ script: row.script });
      }
    },
  });

  return (
    <DrawerFrame
      isDock
      title="Scripts"
      icon={CONCEPT_ICONS.scripts}
      action={newScriptAction}
      toolbar={
        rowCount < FILTER_FROM_ROWS && query === '' ? null : (
          <ScriptsFilterInput value={query} onChange={setQuery} />
        )
      }
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        {groups.length === 0 ? (
          <EmptyLine
            className="px-2"
            action={
              <MountProjectAction
                sessionId={sessionId}
                workspaceId={workspaceId}
                presentation="button"
              />
            }
          >
            No branch in this session to run scripts on.
          </EmptyLine>
        ) : null}
        {ended.count === 0 ? null : <EndedServicesRow {...ended} />}
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
        {groupsNode}
        {unmounted.length === 0 ? null : (
          <UnmountedScriptsNote
            sessionId={sessionId}
            workspaceId={workspaceId}
            entries={unmounted}
            hasAction={groups.length > 0}
          />
        )}
      </div>
    </DrawerFrame>
  );
};
