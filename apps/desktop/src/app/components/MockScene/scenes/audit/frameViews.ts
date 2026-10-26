import type { useAppOverlays } from '../../../../hooks/useAppOverlays';
import { openSettings } from '../../../../../features/settings/openSettings';
import { dispatchWindowEvent } from '../../../../../shared/lib/dispatchWindowEvent';
import { useAppStore } from '../../../../../store';
import { installIphoneIpc } from '../u26s/settingsTree/installIphoneIpc';

type Openers = ReturnType<typeof useAppOverlays>;

type TriggerParams = {
  readonly view: string;
  readonly openers: Openers;
};

export const triggerFrameView = ({ view, openers }: TriggerParams): void => {
  switch (view) {
    case 'settings':
      openers.openSettings();
      return;
    case 'settings-workspace':
      openSettings({ scope: 'workspace' });
      return;
    case 'settings-providers':
      openers.openProviders();
      return;
    case 'settings-tools':
      openSettings({ scope: 'tools' });
      return;
    case 'shortcuts':
      openers.openShortcutHelp();
      return;
    case 'workflows':
      openers.openWorkflows();
      return;
    case 'inbox':
      openers.openInbox();
      return;
    case 'chat':
      openers.openChat();
      return;
    case 'terminal':
      openers.openTerminalStudio();
      return;
    case 'monitoring':
      openers.openMonitoring();
      return;
    case 'spend':
      openers.openSpend();
      return;
    case 'changelog':
      openers.openChangelog();
      return;
    case 'guide':
      dispatchWindowEvent({ name: 'goodboy:open-guide' });
      return;
    case 'report':
      dispatchWindowEvent({ name: 'goodboy:open-report-sheet' });
      return;
    case 'add-workspace':
      openers.openAddWorkspace();
      return;
    case 'pair':
      installIphoneIpc({ enrolledCount: 1 });
      dispatchWindowEvent({ name: 'goodboy:open-pair-device' });
      return;
    case 'palette':
      openers.openPalette();
      return;
    case 'palette-session':
      useAppStore.setState({ selectedAgentId: {} });
      openers.openPalette();
      return;
    case 'stack':
      openers.openWorkflows();
      window.setTimeout(() => openers.openShortcutHelp(), 50);
      return;
    default:
      return;
  }
};
