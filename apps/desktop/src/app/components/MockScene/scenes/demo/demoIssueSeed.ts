import { mockIPC } from '@tauri-apps/api/mocks';
import { useAppStore } from '../../../../../store';
import { EMPTY_SESSION_DRAFT } from '../../../../../store/slices/sessionDraft/state';
import { BOARD_STORY_SESSION, WORKSPACE_ID, seedBoardScene } from '../BoardScene';
import { HBL_412, KICKOFF_ASSIGNED, linearBindingOf, linearRecordOf } from '../brand/kickoffIssues';
import { startInboxIpc } from '../u23/StartInboxScene';

const installIpc = (): void => {
  mockIPC((command, payload) => {
    if (command === 'linear_fetch_assigned_issues') {
      return KICKOFF_ASSIGNED;
    }
    if (command === 'linear_fetch_issue_comments') {
      return [];
    }
    return startInboxIpc({ command, payload });
  });
};

export const seedDemoIssue = (): void => {
  installIpc();
  seedBoardScene();
  useAppStore.setState((state) => ({
    notifications: [],
    notificationsLoading: false,
    notificationCounts: [],
    loadNotifications: async () => undefined,
    markNotificationsRead: async () => undefined,
    clearNotifications: async () => undefined,
    scriptRuns: {},
    projectScripts: {},
    loadPhaseTemplates: async () => undefined,
    loadStepLibrary: async () => undefined,
    sessions: state.sessions.filter((session) => session.id !== BOARD_STORY_SESSION),
    sessionExternalTasks: {},
    workspaceIntegrations: { [WORKSPACE_ID]: [linearBindingOf({ workspaceId: WORKSPACE_ID })] },
    sessionDrafts: {
      [WORKSPACE_ID]: {
        ...EMPTY_SESSION_DRAFT,
        hasChosenStart: true,
        startKind: 'agent',
        startShape: 'agent',
        agentKind: 'implementer',
      },
    },
    openSessionDraftWorkspaceId: null,
    currentSessionId: null,
  }));
  useAppStore.getState().openStudio({
    studio: {
      kind: 'inbox',
      focus: {
        provider: 'linear',
        kind: 'issue',
        recordKey: linearRecordOf(HBL_412).key,
        sessionId: null,
      },
    },
  });
};
