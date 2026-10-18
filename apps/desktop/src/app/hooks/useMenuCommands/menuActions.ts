import { useAppStore } from '../../../store';
import { selectChatDoor } from '../../../store/slices/chat-last-open/selectChatDoor';
import { NAMES } from '../../../shared/names';
import { NOTIFICATIONS_STUDIO_EVENT } from '../../../features/notifications/studioEvent';
import { openImpactStudio } from '../../../features/impact/openImpactStudio';
import { openChangelogStudio } from '../../../features/changelog/changelogStudioEvent';
import { openSessionTerminalHere } from '../../../features/terminal/openSessionTerminalHere';
import { openWorkspaceTerminal } from '../../../features/terminal/openWorkspaceTerminal';

type MenuAction = {
  readonly label: string;
  readonly run: () => void;
};

type FireParams = {
  readonly name: string;
  readonly detail?: unknown;
};

type GuardParams = {
  readonly run: () => void;
};

const CHECKABLE_STATUSES: ReadonlySet<string> = new Set(['idle', 'uptodate', 'error']);

const fire = ({ name, detail }: FireParams): void => {
  window.dispatchEvent(
    detail === undefined ? new CustomEvent(name) : new CustomEvent(name, { detail }),
  );
};

const inWorkspace =
  ({ run }: GuardParams) =>
  (): void => {
    if (useAppStore.getState().currentWorkspaceId === null) {
      return;
    }
    run();
  };

const openNotifications = (): void => {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_STUDIO_EVENT, { detail: { door: true } }));
};

const checkForUpdates = (): void => {
  fire({ name: 'goodboy:open-settings', detail: { scope: 'app', section: 'general', door: true } });
  const state = useAppStore.getState();
  if (!CHECKABLE_STATUSES.has(state.updaterStatus)) {
    return;
  }
  void state.checkForUpdates();
};

const openNewTerminal = (): void => {
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId;
  if (workspaceId === null) {
    return;
  }
  const sessionId = state.currentSessionId;
  if (sessionId !== null && state.appStudio === null) {
    void openSessionTerminalHere({ sessionId, isFresh: true });
    return;
  }
  void openWorkspaceTerminal({ workspaceId });
};

export const MENU_ACTIONS = {
  'menu.checkForUpdates': { label: 'Check for updates', run: checkForUpdates },
  'menu.newTerminal': { label: 'New terminal', run: openNewTerminal },
  'menu.newWorkspace': {
    label: 'New workspace',
    run: () => fire({ name: 'goodboy:add-workspace' }),
  },
  'menu.tasks': {
    label: NAMES.tasks,
    run: inWorkspace({
      run: () => fire({ name: 'goodboy:open-inbox', detail: { door: true } }),
    }),
  },
  'menu.chat': {
    label: 'Chat',
    run: inWorkspace({
      run: () => {
        const state = useAppStore.getState();
        state.openStudio({ studio: { kind: 'chat', chatId: selectChatDoor({ state }) } });
      },
    }),
  },
  'menu.workflows': {
    label: 'Workflows',
    run: inWorkspace({
      run: () => fire({ name: 'goodboy:open-workflow-studio', detail: { door: true } }),
    }),
  },
  'menu.impact': {
    label: 'Impact',
    run: inWorkspace({ run: () => openImpactStudio({ door: true }) }),
  },
  'menu.notifications': {
    label: 'Notifications',
    run: inWorkspace({
      run: openNotifications,
    }),
  },
  'menu.monitoring': {
    label: 'Monitoring',
    run: inWorkspace({
      run: () => useAppStore.getState().openStudio({ studio: { kind: 'monitoring' } }),
    }),
  },
  'menu.guide': { label: 'Guide', run: () => fire({ name: 'goodboy:open-guide' }) },
  'menu.whatsNew': { label: NAMES.whatsNew, run: inWorkspace({ run: openChangelogStudio }) },
} as const satisfies Readonly<Record<string, MenuAction>>;
