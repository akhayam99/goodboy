import type { Overlay } from '../../app/hooks/useAppOverlays/overlayState';
import type { ChangelogScreen } from './changelogScreens';

export type ResolveChangelogScreenOverlayParams = {
  readonly screen: ChangelogScreen;
};

export const resolveChangelogScreenOverlay = ({
  screen,
}: ResolveChangelogScreenOverlayParams): Overlay => {
  if (screen === 'workflows' || screen === 'workflows/steps') {
    return { kind: 'workflow' };
  }
  if (screen === 'inbox') {
    return { kind: 'inbox', focus: null };
  }
  if (screen === 'notifications') {
    return { kind: 'notifications' };
  }
  if (screen === 'impact') {
    return { kind: 'impact', scope: null };
  }
  if (screen === 'settings/app') {
    return { kind: 'settings', focus: { scope: 'app' } };
  }
  if (screen === 'settings/app/storage') {
    return { kind: 'settings', focus: { scope: 'app', section: 'storage' } };
  }
  if (screen === 'settings/providers') {
    return { kind: 'settings', focus: { scope: 'providers' } };
  }
  if (screen === 'settings/tools') {
    return { kind: 'settings', focus: { scope: 'tools' } };
  }
  if (screen === 'settings/workspace/projects') {
    return { kind: 'settings', focus: { scope: 'workspace', section: 'projects' } };
  }
  if (screen === 'settings/workspace/review-replies') {
    return { kind: 'settings', focus: { scope: 'workspace', section: 'review-replies' } };
  }
  const exhaustive: never = screen;
  throw new Error(`unhandled changelog screen: ${String(exhaustive)}`);
};
