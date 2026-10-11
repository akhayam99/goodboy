import { useCallback } from 'react';
import { useShortcut } from '../../../shared/keyboard/useShortcut';
import { isTerminalFocused } from '../../../shared/keyboard/isTerminalFocused';
import { WORKSPACE_DIGIT_IDS } from '../../../shared/keyboard/registry';
import { workspacesByDigit } from '../../../features/workspace/recent';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import {
  branchPlace,
  useAppStore,
  useCurrentWorkspace,
  useWorkspaces,
  type LensKind,
} from '../../../store';
import { doorMountPath } from '../../../store/slices/navigation/doorMountPath';
import { branchTabOf } from '../../../store/slices/session-view/branchTabOf';
import { requestNewSession } from '../../../features/session/requestNewSession';
import { openLens } from '../../../features/session/openLens';
import { isLensReachable } from '../../../features/session/isLensReachable';
import { isBranchTabAvailable } from '../../../features/branch/branchTabs';
import type { OpenPaletteParams } from '../../../features/palette/paletteModeTypes';
import type { ContextDrawerTab } from '../../../store/slices/drawer/state';
import type { BranchTab } from '../../../store/slices/navigation/types';
import { useMouseHistoryButtons } from '../useMouseHistoryButtons';
import { useGoToBoard } from '../useGoToBoard';
import { useSessionNavigation } from '../useSessionNavigation';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';

type AppShortcutsParams = {
  readonly armDeleteConfirm: () => void;
  readonly openPalette: (params?: OpenPaletteParams) => void;
  readonly openSettings: () => void;
  readonly openShortcutHelp: () => void;
  readonly toggleSidebar: () => void;
  readonly sidebarToggleScope?: 'everywhere' | 'session';
};

type IndexParams = {
  readonly index: number;
};

type LensParams = {
  readonly kind: LensKind | null;
};

type ContextParams = {
  readonly tab?: ContextDrawerTab;
};

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
  openShortcutHelp,
  toggleSidebar,
  sidebarToggleScope = 'session',
}: AppShortcutsParams): void => {
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

  const toggleContext = useCallback(({ tab }: ContextParams) => {
    const state = useAppStore.getState();
    const sessionId = state.currentSessionId;
    if (sessionId == null) {
      return;
    }
    state.toggleContextDrawer({ sessionId, ...(tab !== undefined && { tab }) });
  }, []);

  const goToLens = useCallback(({ kind }: LensParams) => {
    const state = useAppStore.getState();
    const sessionId = state.currentSessionId;
    if (sessionId == null || !isLensReachable({ state, sessionId, lens: kind })) {
      return;
    }
    const active = state.activeLens[sessionId] ?? null;
    const isBranchDoor =
      active === 'branch' &&
      (kind === 'review' || kind === 'pr' || kind === 'files') &&
      branchTabOf({ state, sessionId, mountPath: null }) === doorTabOf({ kind });
    const isLeaving = kind != null && (active === kind || isBranchDoor);
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

  const isExploreSession = useAppStore((state) => {
    const sessionId = state.currentSessionId;
    if (sessionId == null) {
      return false;
    }
    const session = sessionById(state.sessions, sessionId);
    if (session == null) {
      return false;
    }
    return isBranchlessSession({
      branch: state.sessionBranches[sessionId],
    });
  });

  const openNewSession = useCallback(() => {
    if (currentWorkspace == null) {
      return;
    }
    requestNewSession();
  }, [currentWorkspace]);

  const openModelPicker = useCallback(() => {
    window.dispatchEvent(new CustomEvent('goodboy:open-model-picker'));
  }, []);

  const openPermissionPicker = useCallback(() => {
    window.dispatchEvent(new CustomEvent('goodboy:open-permission-picker'));
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
  useShortcut('workspace.switcher', () =>
    window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher')),
  );
  const toggleVisibleSidebar = useCallback(() => {
    const state = useAppStore.getState();
    if (
      sidebarToggleScope === 'session' &&
      (state.currentSessionId === null || state.appStudio !== null)
    ) {
      return;
    }
    if (sidebarToggleScope === 'everywhere' && state.appStudio?.kind === 'settings') {
      return;
    }
    toggleSidebar();
  }, [toggleSidebar, sidebarToggleScope]);
  const goToBoard = useGoToBoard();

  useShortcut('column.toggle', toggleVisibleSidebar);
  useShortcut('nav.back', back);
  useShortcut('nav.forward', forward);
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

  useShortcut('lens.overview', () => goToLens({ kind: null }));
  useShortcut('lens.context', () => toggleContext({}));
  useShortcut('lens.goal', () => toggleContext({ tab: 'goal' }));
  useShortcut('lens.decisions', () => toggleContext({ tab: 'decisions' }));
  useShortcut('lens.summary', () => toggleContext({ tab: 'summary' }));
  useShortcut('lens.workflows', () => goToLens({ kind: 'workflows' }));
  useShortcut('lens.agents', () => goToLens({ kind: 'agents' }));
  useShortcut('lens.review', () => goToLens({ kind: 'review' }));
  useShortcut('lens.questions', () => goToLens({ kind: 'questions' }));
  useShortcut('lens.files', () => goToLens({ kind: 'files' }), !isExploreSession);
  useShortcut('lens.explore', () => goToLens({ kind: 'explore' }), isExploreSession);
  useShortcut('lens.plans', () => goToLens({ kind: 'plans' }));
  useShortcut('lens.scripts', () => goToLens({ kind: 'scripts' }));
  useShortcut('lens.terminal', () => goToLens({ kind: 'terminal' }));
  useShortcut('lens.pr', () => goToLens({ kind: 'pr' }));
  useShortcut('lens.linear', () => goToLens({ kind: 'linear' }));
  useShortcut('lens.gitlab_issues', () => goToLens({ kind: 'gitlab_issues' }));
  useShortcut('lens.jira_issues', () => goToLens({ kind: 'jira_issues' }));
  useShortcut('lens.slack_threads', () => goToLens({ kind: 'slack_threads' }));
};
