import { useCallback } from 'react';
import { innerColumnStore } from '@goodboy/ui';
import { useShortcut } from '../../../shared/keyboard/useShortcut';
import { isTerminalFocused } from '../../../shared/keyboard/isTerminalFocused';
import { useShortcutOverrides } from '../../../shared/keyboard/overrides/useShortcutOverrides';
import { WORKSPACE_DIGIT_IDS } from '../../../shared/keyboard/registry';
import { workspacesByDigit } from '../../../features/workspace/recent';
import {
  branchPlace,
  useAppStore,
  useCurrentWorkspace,
  useWorkspaces,
  type LensKind,
} from '../../../store';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { doorMountPath } from '../../../store/slices/navigation/doorMountPath';
import { foldedLensOf } from '../../../store/slices/navigation/foldedLensOf';
import { branchTabOf } from '../../../store/slices/session-view/branchTabOf';
import { requestNewSession } from '../../../features/session/requestNewSession';
import { toggleTerminalDock } from '../../../features/terminal/toggleTerminalDock';
import { openLens } from '../../../features/session/openLens';
import { togglePane } from '../../../features/session/panes/togglePane';
import type { ClusterPane } from '../../../features/session/panes/clusterPane';
import { isLensReachable } from '../../../features/session/isLensReachable';
import { isBranchTabAvailable } from '../../../features/branch/branchTabs';
import type { OpenPaletteParams } from '../../../features/palette/paletteModeTypes';
import {
  openToolPane,
  type ToolPaneDestination,
} from '../../../features/session/panes/openToolPane';
import type { BranchTab } from '../../../store/slices/navigation/types';
import { providerOfListLens } from '../../../store/slices/navigation/providerOfListLens';
import { useMouseHistoryButtons } from '../useMouseHistoryButtons';
import { useMenuCommands } from '../useMenuCommands';
import { usePageKeys } from '../../../features/browser/hooks/usePageKeys';
import { closeCurrentLevel } from './closeCurrentLevel';
import { closeSlot } from './closeSlot';
import { goUp } from './goUp';
import { useGoToBoard } from '../useGoToBoard';
import { useSessionNavigation } from '../useSessionNavigation';
import { dispatchWindowEvent } from '../../../shared/lib/dispatchWindowEvent';

type AppShortcutsParams = {
  readonly armDeleteConfirm: () => void;
  readonly openPalette: (params?: OpenPaletteParams) => void;
  readonly openSettings: () => void;
  readonly openNewChat: () => void;
  readonly openShortcutHelp: () => void;
  readonly toggleSidebar: () => void;
};

type IndexParams = {
  readonly index: number;
};

type LensParams = {
  readonly kind: LensKind | null;
};

type PlaceParams = {
  readonly pane: ToolPaneDestination;
};

type PaneParams = {
  readonly pane: ClusterPane;
};

const OBJECT_PAGE_LENSES: ReadonlySet<LensKind> = new Set<LensKind>([
  'workflows',
  'plans',
  'context',
]);

const doorTabOf = ({ kind }: { readonly kind: LensKind | null }): BranchTab => {
  if (kind === 'files') {
    return 'files';
  }
  return kind === 'pr' && isBranchTabAvailable('pr') ? 'pr' : 'comments';
};

export const useAppShortcuts = ({
  armDeleteConfirm,
  openPalette,
  openSettings,
  openNewChat,
  openShortcutHelp,
  toggleSidebar,
}: AppShortcutsParams): void => {
  useShortcutOverrides();
  const workspaces = useWorkspaces();
  const currentWorkspace = useCurrentWorkspace();
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const back = useAppStore((state) => state.back);
  const forward = useAppStore((state) => state.forward);

  const selectWorkspaceByIndex = useCallback(
    ({ index }: IndexParams) => {
      const workspace = workspacesByDigit({
        workspaces,
        currentId: currentWorkspace?.id ?? null,
        limit: WORKSPACE_DIGIT_IDS.length,
      })[index];
      if (workspace === undefined) {
        return;
      }
      void openWorkspace({ id: workspace.id, title: workspace.name, onRunning: 'new-window' });
    },
    [workspaces, currentWorkspace, openWorkspace],
  );

  const navigateSession = useSessionNavigation();

  const openCurrentPlace = useCallback(({ pane }: PlaceParams) => {
    const sessionId = useAppStore.getState().currentSessionId;
    if (sessionId == null) {
      return;
    }
    openToolPane({ sessionId, pane });
  }, []);

  const toggleCurrentPane = useCallback(({ pane }: PaneParams) => {
    const sessionId = useAppStore.getState().currentSessionId;
    if (sessionId == null) {
      return;
    }
    togglePane({ sessionId, pane });
  }, []);

  const goToLens = useCallback(({ kind }: LensParams) => {
    const state = useAppStore.getState();
    const sessionId = state.currentSessionId;
    if (sessionId == null || !isLensReachable({ state, sessionId, lens: kind })) {
      return;
    }
    const active = foldedLensOf({ lens: state.activeLens[sessionId] ?? null });
    const isBranchDoor =
      active === 'branch' &&
      (kind === 'review' || kind === 'pr' || kind === 'files') &&
      branchTabOf({ state, sessionId }) === doorTabOf({ kind });
    if (kind !== null && OBJECT_PAGE_LENSES.has(kind) && active === kind) {
      const openDrawerKind = selectOpenDrawer(state)?.kind ?? null;
      const isBelowPage =
        state.appStudio !== null ||
        (openDrawerKind !== null && openDrawerKind !== 'ask') ||
        (state.selectedAgentId[sessionId] ?? null) !== null ||
        (kind === 'workflows' && (state.focusedWorkflowRunId[sessionId] ?? null) !== null) ||
        (kind === 'plans' &&
          ((state.focusedArtifactId[sessionId] ?? null) !== null ||
            (state.focusedRunAgentId[sessionId] ?? null) !== null));
      if (isBelowPage) {
        if (kind === 'plans') {
          state.setFocusedRunAgent({ sessionId, agentId: null });
        }
        openLens({ sessionId, lens: kind });
      }
      return;
    }
    if (kind === 'files' && active === 'branch' && !isBranchDoor) {
      state.navigate({
        to: branchPlace({
          sessionId,
          mountPath: state.diffMountPath[sessionId] ?? doorMountPath({ state, sessionId }),
          tab: 'files',
        }),
      });
      return;
    }
    const isLeaving =
      kind != null &&
      providerOfListLens({ lens: kind }) === null &&
      (active === kind || isBranchDoor);
    if (kind === 'review' && !isLeaving) {
      state.navigate({
        to: branchPlace({
          sessionId,
          mountPath: doorMountPath({ state, sessionId }),
          tab: 'comments',
        }),
      });
      return;
    }
    openLens({ sessionId, lens: isLeaving ? null : kind });
  }, []);

  const openNewSession = useCallback(() => {
    if (currentWorkspace == null) {
      return;
    }
    requestNewSession();
  }, [currentWorkspace]);

  const openModelPicker = useCallback(() => {
    dispatchWindowEvent({ name: 'goodboy:open-model-picker' });
  }, []);

  const openPermissionPicker = useCallback(() => {
    dispatchWindowEvent({ name: 'goodboy:open-permission-picker' });
  }, []);

  useShortcut('settings.open', openSettings);
  useShortcut('settings.shortcuts', openShortcutHelp);
  useShortcut('palette.open', () => openPalette());
  useShortcut('search.open', () => {
    if (isTerminalFocused()) {
      return;
    }
    openPalette({ mode: 'search' });
  });
  useShortcut('session.new', openNewSession);
  useShortcut('chat.new', openNewChat);
  useShortcut('workspace.switcher', () =>
    dispatchWindowEvent({ name: 'goodboy:open-workspace-switcher' }),
  );
  const goToBoard = useGoToBoard();

  useShortcut('column.toggle', toggleSidebar);
  useShortcut('innerColumn.toggle', () => {
    innerColumnStore.toggleCurrent();
  });
  useShortcut('nav.back', back);
  useShortcut('nav.forward', forward);
  useShortcut('nav.up', () => goUp({}));
  useMouseHistoryButtons({ back, forward });
  useShortcut('workspace.1', () => selectWorkspaceByIndex({ index: 0 }));
  useShortcut('workspace.2', () => selectWorkspaceByIndex({ index: 1 }));
  useShortcut('workspace.3', () => selectWorkspaceByIndex({ index: 2 }));
  useShortcut('workspace.4', () => selectWorkspaceByIndex({ index: 3 }));
  useShortcut('workspace.5', () => selectWorkspaceByIndex({ index: 4 }));
  useShortcut('workspace.6', () => selectWorkspaceByIndex({ index: 5 }));
  useShortcut('workspace.7', () => selectWorkspaceByIndex({ index: 6 }));
  useShortcut('workspace.8', () => selectWorkspaceByIndex({ index: 7 }));
  useShortcut('workspace.9', () => selectWorkspaceByIndex({ index: 8 }));

  useShortcut('session.delete', armDeleteConfirm);
  useShortcut('session.model', openModelPicker);
  useShortcut('session.permissions', openPermissionPicker);
  useShortcut('session.prev', () => navigateSession({ delta: -1 }));
  useShortcut('session.next', () => navigateSession({ delta: 1 }));
  useShortcut('session.board', goToBoard);
  useShortcut('terminal.studio', () => toggleTerminalDock({ isToggle: true }));
  useShortcut('app.close', () => closeCurrentLevel({}));
  useShortcut('slot.close', () => closeSlot({}));
  useMenuCommands();
  usePageKeys();

  useShortcut('lens.overview', () => goToLens({ kind: null }));
  useShortcut('lens.context', () => goToLens({ kind: 'context' }));
  useShortcut('lens.workflows', () => goToLens({ kind: 'workflows' }));
  useShortcut('lens.review', () => goToLens({ kind: 'review' }));
  useShortcut('lens.questions', () => goToLens({ kind: 'questions' }));
  useShortcut('lens.files', () => goToLens({ kind: 'files' }));
  useShortcut('lens.explore', () => openCurrentPlace({ pane: 'explore' }));
  useShortcut('lens.plans', () => goToLens({ kind: 'plans' }));
  useShortcut('lens.scripts', () => toggleCurrentPane({ pane: 'scripts' }));
  useShortcut('session.spawned', () => openCurrentPlace({ pane: 'spawned' }));
  useShortcut('session.terminal', () => toggleTerminalDock({ isToggle: true }));
  useShortcut('lens.pr', () => goToLens({ kind: 'pr' }));
  useShortcut('lens.linear', () => goToLens({ kind: 'linear' }));
  useShortcut('lens.gitlab_issues', () => goToLens({ kind: 'gitlab_issues' }));
  useShortcut('lens.jira_issues', () => goToLens({ kind: 'jira_issues' }));
  useShortcut('lens.slack_threads', () => goToLens({ kind: 'slack_threads' }));
};
