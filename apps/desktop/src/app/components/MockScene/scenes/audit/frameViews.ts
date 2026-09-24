import type { useAppOverlays } from '../../../../hooks/useAppOverlays';

type Openers = ReturnType<typeof useAppOverlays>;

type TriggerParams = {
  readonly view: string;
  readonly openers: Openers;
};

type FireParams = {
  readonly name: string;
  readonly detail?: unknown;
};

const fire = ({ name, detail }: FireParams): void => {
  window.dispatchEvent(new CustomEvent(name, { detail }));
};

export const triggerFrameView = ({ view, openers }: TriggerParams): void => {
  switch (view) {
    case 'settings':
      openers.openSettings();
      return;
    case 'settings-workspace':
      fire({ name: 'goodboy:open-settings', detail: { scope: 'workspace' } });
      return;
    case 'settings-providers':
      openers.openProviders();
      return;
    case 'settings-tools':
      fire({ name: 'goodboy:open-settings', detail: { scope: 'tools' } });
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
    case 'github':
      openers.openIntegration({ provider: 'github' });
      return;
    case 'impact':
      openers.openImpact();
      return;
    case 'spend':
      openers.openSpend();
      return;
    case 'changelog':
      openers.openChangelog();
      return;
    case 'guide':
      fire({ name: 'goodboy:open-guide' });
      return;
    case 'report':
      fire({ name: 'goodboy:open-report-issue' });
      return;
    case 'add-workspace':
      openers.openAddWorkspace();
      return;
    case 'pair':
      fire({ name: 'goodboy:open-pair-device' });
      return;
    case 'palette':
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
