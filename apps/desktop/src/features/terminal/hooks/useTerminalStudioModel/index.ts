import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId, SessionProjectMount, WorkspaceId } from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../../../shared/types/terminal';
import { homeFolder } from '../../../../shared/lib/homeFolder';
import { useAppStore } from '../../../../store';
import { selectActiveMount } from '../../../../store/slices/project-mounts/selectors';
import { selectTerminalWorkspaceFolder } from '../../../../store/slices/terminal/selectors';
import {
  DEFAULT_TERMINAL_NAME,
  folderName,
  sessionTerminalOwner,
  terminalOwnerKey,
  workspaceTerminalOwner,
} from '../../../../store/slices/terminal/terminalOwner';
import {
  selectedTerminal,
  terminalGroups,
  terminalSessionBranches,
  type TerminalGroup,
} from '../../components/TerminalStudio/terminalGroups';
import { forgetTerminalCommand, lastCommandOf } from '../../commandTracker';
import { invokeTerminalWrite } from '../../terminal';
import { stringToBase64 } from '../../terminalDriver';
import { terminalTargets, type TerminalTarget } from '../../terminalTargets';
import { useTerminalExitWatch } from '../useTerminalExitWatch';
import { useTerminalLedger } from '../useTerminalLedger';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly selectedId: TerminalTabId | null;
  readonly focusSessionId: SessionId | null;
  readonly sessionCwd?: string | null;
  readonly onSelect: (params: SelectParams) => void;
};

type RenameParams = {
  readonly tab: TerminalTab;
  readonly title: string;
};

type QuoteParams = {
  readonly path: string;
};

type SelectParams = {
  readonly id: TerminalTabId | null;
  readonly sessionId: SessionId | null;
};

export type TerminalStudioModel = {
  readonly groups: ReadonlyArray<TerminalGroup>;
  readonly selected: TerminalTab | null;
  readonly targets: ReadonlyArray<TerminalTarget>;
  readonly folder: string | null;
  readonly home: string | null;
  readonly busyIds: ReadonlySet<string>;
  readonly select: (tab: TerminalTab) => void;
  readonly openAt: (target: TerminalTarget) => void;
  readonly openDefault: () => void;
  readonly closeTab: (tab: TerminalTab) => void;
  readonly restartTab: (tab: TerminalTab) => void;
  readonly renameTab: (params: RenameParams) => Promise<void>;
  readonly changeDirectory: (target: TerminalTarget) => void;
  readonly commandOf: (tab: TerminalTab) => string | null;
};

const NO_MOUNTS: ReadonlyArray<SessionProjectMount> = [];

const shellQuote = ({ path }: QuoteParams): string => `'${path.split("'").join("'\\''")}'`;

export const useTerminalStudioModel = ({
  workspaceId,
  selectedId,
  focusSessionId,
  sessionCwd = null,
  onSelect,
}: Params): TerminalStudioModel => {
  const terminalTabs = useAppStore((s) => s.terminalTabs);
  const sessions = useAppStore((s) => s.sessions);
  const branches = useAppStore(useShallow((s) => terminalSessionBranches({ state: s })));
  const projects = useAppStore((s) => s.projects);
  const overrides = useAppStore((s) => s.terminalFolderOverrides);
  const addTerminalTab = useAppStore((s) => s.addTerminalTab);
  const closeTerminalTab = useAppStore((s) => s.closeTerminalTab);
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

  const groups = useMemo(
    () => terminalGroups({ workspaceId, terminalTabs, sessions, branches }),
    [workspaceId, terminalTabs, sessions, branches],
  );
  const selected = useMemo(
    () => selectedTerminal({ groups, selectedId, focusSessionId }),
    [groups, selectedId, focusSessionId],
  );
  const allTabs = useMemo(() => groups.flatMap((group) => group.tabs), [groups]);
  const busyIds = useTerminalLedger({ isEnabled: allTabs.length > 0 });
  useTerminalExitWatch({ tabs: allTabs });

  const folder = selectTerminalWorkspaceFolder({
    state: { projects, terminalFolderOverrides: overrides },
    workspaceId,
    home,
  });
  const contextSessionId =
    focusSessionId ?? (selected?.owner.kind === 'session' ? selected.owner.sessionId : null);
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

  const select = useCallback(
    (tab: TerminalTab) =>
      onSelect({
        id: tab.id,
        sessionId: tab.owner.kind === 'session' ? tab.owner.sessionId : contextSessionId,
      }),
    [onSelect, contextSessionId],
  );

  const openAt = useCallback(
    (target: TerminalTarget) => {
      const owner =
        target.kind === 'workspace'
          ? workspaceTerminalOwner({ workspaceId })
          : sessionTerminalOwner({ sessionId: target.sessionId });
      const id = addTerminalTab({ owner, cwd: target.path });
      onSelect({
        id,
        sessionId: target.kind === 'session' ? target.sessionId : contextSessionId,
      });
    },
    [addTerminalTab, onSelect, workspaceId, contextSessionId],
  );

  const openDefault = useCallback(() => {
    if (sessionCwd !== null && focusSessionId !== null) {
      const id = addTerminalTab({
        owner: sessionTerminalOwner({ sessionId: focusSessionId }),
        cwd: sessionCwd,
      });
      onSelect({ id, sessionId: focusSessionId });
      return;
    }
    const first = targets[0];
    if (first !== undefined) {
      openAt(first);
      return;
    }
    const id = addTerminalTab({ owner: workspaceTerminalOwner({ workspaceId }), cwd: null });
    onSelect({ id, sessionId: contextSessionId });
  }, [
    sessionCwd,
    focusSessionId,
    targets,
    openAt,
    addTerminalTab,
    onSelect,
    workspaceId,
    contextSessionId,
  ]);

  const closeTab = useCallback(
    (tab: TerminalTab) => {
      forgetTerminalCommand({ terminalId: tab.id });
      closeTerminalTab({ owner: tab.owner, tabId: tab.id });
      if (selected?.id !== tab.id) {
        return;
      }
      const neighbours = allTabs.filter((candidate) => candidate.id !== tab.id);
      const key = terminalOwnerKey({ owner: tab.owner });
      const next =
        neighbours.find((candidate) => terminalOwnerKey({ owner: candidate.owner }) === key) ??
        null;
      onSelect({
        id: next?.id ?? null,
        sessionId: tab.owner.kind === 'session' ? tab.owner.sessionId : contextSessionId,
      });
    },
    [closeTerminalTab, selected, allTabs, onSelect, contextSessionId],
  );

  const restartTab = useCallback(
    (tab: TerminalTab) => {
      const hasCustomName = tab.title !== (folderName({ path: tab.cwd }) ?? DEFAULT_TERMINAL_NAME);
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
        stringToBase64({ value: `cd ${shellQuote({ path: target.path })}\r` }),
      ).catch((error) =>
        reportError({ title: 'Could not change the terminal folder', error, workspaceId }),
      );
    },
    [selected, busyIds, reportError, workspaceId],
  );

  const commandOf = useCallback((tab: TerminalTab) => lastCommandOf({ terminalId: tab.id }), []);

  return {
    groups,
    selected,
    targets,
    folder,
    home,
    busyIds,
    select,
    openAt,
    openDefault,
    closeTab,
    restartTab,
    renameTab,
    changeDirectory,
    commandOf,
  };
};
