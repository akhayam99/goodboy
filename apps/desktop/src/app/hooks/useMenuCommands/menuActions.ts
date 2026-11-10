import { useAppStore } from '../../../store';
import { dispatchWindowEvent } from '../../../shared/lib/dispatchWindowEvent';
import type { PageDestinationId } from '../../../shared/navigation/destinations';
import { destinationOf } from '../../../shared/navigation/destinationOf';
import { openDestination } from '../../../shared/navigation/openDestination';
import { checkForUpdatesNow } from '../../../features/updater/checkForUpdatesNow';
import { openSessionTerminalHere } from '../../../features/terminal/openSessionTerminalHere';
import { openWorkspaceTerminal } from '../../../features/terminal/openWorkspaceTerminal';
import { toggleBrowserDock } from '../../../features/browser/toggleBrowserDock';

type MenuAction = {
  readonly label: string;
  readonly run: () => void;
};

type GuardParams = {
  readonly run: () => void;
};

const inWorkspace =
  ({ run }: GuardParams) =>
  (): void => {
    if (useAppStore.getState().currentWorkspaceId === null) {
      return;
    }
    run();
  };

type DestinationActionParams = {
  readonly id: PageDestinationId;
  readonly isGuarded?: boolean;
};

const destinationAction = ({ id, isGuarded = true }: DestinationActionParams): MenuAction => {
  const run = (): void => openDestination({ id });
  return {
    label: destinationOf({ id }).label,
    run: isGuarded ? inWorkspace({ run }) : run,
  };
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
  void openWorkspaceTerminal({ workspaceId, isFresh: true });
};

export const MENU_ACTIONS = {
  'menu.checkForUpdates': { label: 'Check for updates', run: checkForUpdatesNow },
  'menu.newTerminal': { label: 'New terminal', run: openNewTerminal },
  'menu.newWorkspace': {
    label: 'New workspace',
    run: () => dispatchWindowEvent({ name: 'goodboy:add-workspace' }),
  },
  'menu.tasks': destinationAction({ id: 'inbox' }),
  'menu.chat': destinationAction({ id: 'chat' }),
  'menu.workflows': destinationAction({ id: 'workflows' }),
  'menu.impact': destinationAction({ id: 'impact' }),
  'menu.notifications': destinationAction({ id: 'notifications' }),
  'menu.monitoring': destinationAction({ id: 'monitoring' }),
  'menu.browser': {
    label: destinationOf({ id: 'browser' }).label,
    run: inWorkspace({ run: () => toggleBrowserDock({ isToggle: false }) }),
  },
  'menu.guide': destinationAction({ id: 'guide', isGuarded: false }),
  'menu.whatsNew': destinationAction({ id: 'whatsNew' }),
} as const satisfies Readonly<Record<string, MenuAction>>;
