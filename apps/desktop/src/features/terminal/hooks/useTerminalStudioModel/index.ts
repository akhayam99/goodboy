import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId, SessionProjectMount, WorkspaceId } from '@goodboy/types';
import type {
  TerminalOwner,
  TerminalSelection,
  TerminalTab,
  TerminalTabId,
} from '../../../../shared/types/terminal';
import { homeFolder } from '../../../../shared/lib/homeFolder';
import { useAppStore } from '../../../../store';
import { selectActiveMount } from '../../../../store/slices/project-mounts/selectors';
import { selectTerminalWorkspaceFolder } from '../../../../store/slices/terminal/selectors';
import {
  isDefaultTerminalTitle,
  sessionTerminalOwner,
  terminalOwnerKey,
  workspaceTerminalOwner,
} from '../../../../store/slices/terminal/terminalOwner';
import {
  activeTabOf,
  allWorktrees,
  selectedWorktree,
  terminalGroups,
  type TerminalGroup,
  type TerminalWorktree,
} from '../../terminalWorktrees';
import { terminalWorktreeKeyIn } from '../../../../store/slices/terminal/terminalWorktree';
import { changeDirectoryInput } from '../../changeDirectoryInput';
import { forgetTerminalCommand, lastCommandOf } from '../../commandTracker';
import { invokeTerminalWrite } from '../../terminal';
import { stringToBase64 } from '../../terminalDriver';
import { sessionTitle } from '../../../session/sessionTitle';
import { pickerClusters, type PickerCluster } from '../../terminalPickerClusters';
import { terminalTargets, type TerminalTarget } from '../../terminalTargets';
import { useTerminalLedger } from '../useTerminalLedger';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly selectedId: TerminalTabId | null;
  readonly selectedWorktreeKey?: string | null;
  readonly focusSessionId: SessionId | null;
  readonly sessionCwd?: string | null;
  readonly scope?: 'page' | 'session';
  readonly onSelect: (params: TerminalSelectParams) => void;
};

type RenameParams = {
  readonly tab: TerminalTab;
  readonly title: string;
};

type OpenOnParams = {
  readonly owner: TerminalOwner;
  readonly cwd: string | null;
  readonly sessionId: SessionId | null;
};

export type TerminalSelectParams = {
  readonly id: TerminalTabId | null;
  readonly sessionId: SessionId | null;
  readonly worktree: string | null;
};

export type TerminalStudioModel = {
  readonly groups: ReadonlyArray<TerminalGroup>;
  readonly worktree: TerminalWorktree | null;
  readonly tabs: ReadonlyArray<TerminalTab>;
  readonly selected: TerminalTab | null;
  readonly targets: ReadonlyArray<TerminalTarget>;
  readonly pickerClusters: ReadonlyArray<PickerCluster>;
  readonly folder: string | null;
  readonly home: string | null;
  readonly busyIds: ReadonlySet<string>;
  readonly selectWorktree: (worktree: TerminalWorktree) => void;
  readonly selectTab: (tab: TerminalTab) => void;
  readonly newTab: () => void;
  readonly newTabOn: (worktree: TerminalWorktree) => void;
  readonly openAt: (target: TerminalTarget) => void;
  readonly openDefault: () => void;
  readonly closeTab: (tab: TerminalTab) => void;
  readonly restartTab: (tab: TerminalTab) => void;
  readonly renameTab: (params: RenameParams) => Promise<void>;
  readonly changeDirectory: (target: TerminalTarget) => void;
  readonly commandOf: (tab: TerminalTab) => string | null;
};

const NO_MOUNTS: ReadonlyArray<SessionProjectMount> = [];

const NO_TABS: ReadonlyArray<TerminalTab> = [];

const NO_CLUSTERS: ReadonlyArray<PickerCluster> = [];

export const useTerminalStudioModel = ({
  workspaceId,
  selectedId,
  selectedWorktreeKey = null,
  focusSessionId,
  sessionCwd = null,
  scope = 'page',
  onSelect,
}: Params): TerminalStudioModel => {
  const terminalTabs = useAppStore((s) => s.terminalTabs);
  const worktreeActive = useAppStore((s) => s.terminalWorktreeActive);
  const storedSelection = useAppStore((s) => s.terminalSelection);
  const sessions = useAppStore((s) => s.sessions);
  const projects = useAppStore((s) => s.projects);
  const overrides = useAppStore((s) => s.terminalFolderOverrides);
  const addTerminalTab = useAppStore((s) => s.addTerminalTab);
  const closeTerminalTab = useAppStore((s) => s.closeTerminalTab);
  const setActiveTerminalTab = useAppStore((s) => s.setActiveTerminalTab);
  const renameTerminalTab = useAppStore((s) => s.renameTerminalTab);
  const reportError = useAppStore((s) => s.reportError);
  const loadTerminalWorkspaceFolder = useAppStore((s) => s.loadTerminalWorkspaceFolder);
  const [home, setHome] = useState<string | null>(null);

  useEffect(() => {
    void loadTerminalWorkspaceFolder({ workspaceId });
  }, [workspaceId, loadTerminalWorkspaceFolder]);

  useEffect(() => {
    let isCurrent = true;
    void homeFolder().then((found) => {
      if (isCurrent) {
        setHome(found);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  const sessionMounts = useAppStore(
    useShallow((s) =>
      Object.fromEntries(
        s.sessions
          .filter((session) => session.workspaceId === workspaceId)
          .map((session) => [session.id, s.sessionProjectMounts[session.id] ?? NO_MOUNTS]),
      ),
    ),
  );

  const groups = useMemo(
    () =>
      terminalGroups({
        workspaceId,
        terminalTabs,
        sessions,
        mountsBySession: sessionMounts,
        projects,
      }),
    [workspaceId, terminalTabs, sessions, sessionMounts, projects],
  );
  const hasPlaceSelection = selectedId !== null || selectedWorktreeKey !== null;
  const selection: TerminalSelection = useMemo(
    () =>
      hasPlaceSelection
        ? { sessionId: focusSessionId, worktree: selectedWorktreeKey, terminalId: selectedId }
        : (storedSelection ?? { sessionId: focusSessionId, worktree: null, terminalId: null }),
    [hasPlaceSelection, focusSessionId, selectedWorktreeKey, selectedId, storedSelection],
  );
  const worktree = useMemo(
    () =>
      selectedWorktree({
        groups,
        selection,
        focusSessionId: focusSessionId ?? selection.sessionId,
      }),
    [groups, selection, focusSessionId],
  );
  const selected = useMemo(
    () =>
      worktree === null
        ? null
        : activeTabOf({ worktree, active: worktreeActive, terminalId: selection.terminalId }),
    [worktree, worktreeActive, selection.terminalId],
  );
  const allTabs = useMemo(
    () => allWorktrees({ groups }).flatMap((candidate) => candidate.tabs),
    [groups],
  );
  const busyIds = useTerminalLedger({ isEnabled: allTabs.length > 0 });

  const folder = selectTerminalWorkspaceFolder({
    state: { projects, terminalFolderOverrides: overrides },
    workspaceId,
    home,
  });
  const contextSessionId =
    focusSessionId ??
    worktree?.sessionId ??
    (selected?.owner.kind === 'session' ? selected.owner.sessionId : null);
  const contextMounts = useAppStore((s) =>
    contextSessionId === null ? NO_MOUNTS : (s.sessionProjectMounts[contextSessionId] ?? NO_MOUNTS),
  );
  const selectedMountPath = useAppStore((s) =>
    contextSessionId === null
      ? null
      : (selectActiveMount({ state: s, sessionId: contextSessionId })?.worktreePath ?? null),
  );
  const targets = useMemo(
    () =>
      terminalTargets({
        folder,
        sessionId: contextSessionId,
        mounts: contextMounts,
        projects,
        selectedMountPath,
      }),
    [folder, contextSessionId, contextMounts, projects, selectedMountPath],
  );

  const clusters = useMemo(
    () =>
      scope === 'session'
        ? NO_CLUSTERS
        : pickerClusters({
            folder,
            sessions: sessions
              .filter((session) => session.workspaceId === workspaceId)
              .map((session) => ({ id: session.id, title: sessionTitle({ session }) })),
            mountsBySession: sessionMounts,
            projects,
          }),
    [scope, folder, sessions, workspaceId, sessionMounts, projects],
  );

  const selectTab = useCallback(
    (tab: TerminalTab) => {
      setActiveTerminalTab({ owner: tab.owner, tabId: tab.id });
      onSelect({
        id: tab.id,
        sessionId: tab.owner.kind === 'session' ? tab.owner.sessionId : contextSessionId,
        worktree: terminalWorktreeKeyIn({ state: useAppStore.getState(), tab }),
      });
    },
    [onSelect, setActiveTerminalTab, contextSessionId],
  );

  const selectWorktree = useCallback(
    (target: TerminalWorktree) => {
      const tab = activeTabOf({ worktree: target, active: worktreeActive, terminalId: null });
      onSelect({
        id: tab?.id ?? null,
        sessionId: target.sessionId ?? contextSessionId,
        worktree: target.key,
      });
    },
    [onSelect, worktreeActive, contextSessionId],
  );

  const openOn = useCallback(
    ({ owner, cwd, sessionId }: OpenOnParams) => {
      const id = addTerminalTab({ owner, cwd });
      const state = useAppStore.getState();
      const tab = state.terminalTabs[terminalOwnerKey({ owner })]?.find(
        (candidate) => candidate.id === id,
      );
      onSelect({
        id,
        sessionId: sessionId ?? contextSessionId,
        worktree: tab === undefined ? null : terminalWorktreeKeyIn({ state, tab }),
      });
    },
    [addTerminalTab, onSelect, contextSessionId],
  );

  const openAt = useCallback(
    (target: TerminalTarget) => {
      openOn({
        owner:
          target.kind === 'workspace'
            ? workspaceTerminalOwner({ workspaceId })
            : sessionTerminalOwner({ sessionId: target.sessionId }),
        cwd: target.path,
        sessionId: target.kind === 'session' ? target.sessionId : null,
      });
    },
    [openOn, workspaceId],
  );

  const newTabOn = useCallback(
    (target: TerminalWorktree) => {
      const first = target.tabs[0];
      if (first === undefined) {
        return;
      }
      openOn({ owner: first.owner, cwd: target.path, sessionId: target.sessionId });
    },
    [openOn],
  );

  const openDefault = useCallback(() => {
    if (sessionCwd !== null && focusSessionId !== null) {
      openOn({
        owner: sessionTerminalOwner({ sessionId: focusSessionId }),
        cwd: sessionCwd,
        sessionId: focusSessionId,
      });
      return;
    }
    if (worktree !== null) {
      newTabOn(worktree);
      return;
    }
    const first = targets[0];
    if (first !== undefined) {
      openAt(first);
      return;
    }
    openOn({ owner: workspaceTerminalOwner({ workspaceId }), cwd: null, sessionId: null });
  }, [sessionCwd, focusSessionId, worktree, newTabOn, targets, openAt, openOn, workspaceId]);

  const closeTab = useCallback(
    (tab: TerminalTab) => {
      forgetTerminalCommand({ terminalId: tab.id });
      closeTerminalTab({ owner: tab.owner, tabId: tab.id });
      if (selected?.id !== tab.id || worktree === null) {
        return;
      }
      const siblings = worktree.tabs.filter((candidate) => candidate.id !== tab.id);
      const index = worktree.tabs.findIndex((candidate) => candidate.id === tab.id);
      const next = siblings[index - 1] ?? siblings[0] ?? null;
      if (next !== null) {
        onSelect({
          id: next.id,
          sessionId: worktree.sessionId ?? contextSessionId,
          worktree: worktree.key,
        });
        return;
      }
      const fallback =
        allWorktrees({ groups }).find((candidate) => candidate.key !== worktree.key) ?? null;
      const fallbackTab =
        fallback === null
          ? null
          : activeTabOf({ worktree: fallback, active: worktreeActive, terminalId: null });
      onSelect({
        id: fallbackTab?.id ?? null,
        sessionId: fallback?.sessionId ?? contextSessionId,
        worktree: fallback?.key ?? null,
      });
    },
    [closeTerminalTab, selected, worktree, groups, worktreeActive, onSelect, contextSessionId],
  );

  const restartTab = useCallback(
    (tab: TerminalTab) => {
      const hasCustomName = !isDefaultTerminalTitle({ title: tab.title, cwd: tab.cwd });
      const id = addTerminalTab({ owner: tab.owner, cwd: tab.cwd });
      forgetTerminalCommand({ terminalId: tab.id });
      closeTerminalTab({ owner: tab.owner, tabId: tab.id });
      if (hasCustomName) {
        void renameTerminalTab({ owner: tab.owner, tabId: id, title: tab.title }).catch((error) =>
          reportError({
            title: 'Could not keep the terminal name',
            error,
            workspaceId,
          }),
        );
      }
      onSelect({
        id,
        sessionId: tab.owner.kind === 'session' ? tab.owner.sessionId : contextSessionId,
        worktree: terminalWorktreeKeyIn({ state: useAppStore.getState(), tab }),
      });
    },
    [
      closeTerminalTab,
      addTerminalTab,
      renameTerminalTab,
      reportError,
      workspaceId,
      onSelect,
      contextSessionId,
    ],
  );

  const renameTab = useCallback(
    ({ tab, title }: RenameParams) => renameTerminalTab({ owner: tab.owner, tabId: tab.id, title }),
    [renameTerminalTab],
  );

  const changeDirectory = useCallback(
    (target: TerminalTarget) => {
      if (selected === null || busyIds.has(selected.id) || selected.status === 'exited') {
        return;
      }
      void invokeTerminalWrite(
        selected.id,
        stringToBase64({ value: changeDirectoryInput({ path: target.path }) }),
      ).catch((error) =>
        reportError({ title: 'Could not change the terminal folder', error, workspaceId }),
      );
    },
    [selected, busyIds, reportError, workspaceId],
  );

  const commandOf = useCallback((tab: TerminalTab) => lastCommandOf({ terminalId: tab.id }), []);

  return {
    groups,
    worktree,
    tabs: worktree?.tabs ?? NO_TABS,
    selected,
    targets,
    pickerClusters: clusters,
    folder,
    home,
    busyIds,
    selectWorktree,
    selectTab,
    newTab: openDefault,
    newTabOn,
    openAt,
    openDefault,
    closeTab,
    restartTab,
    renameTab,
    changeDirectory,
    commandOf,
  };
};
