import { useAppStore } from '../../store';
import { openSettings } from '../settings/openSettings';

const CHECKABLE_STATUSES: ReadonlySet<string> = new Set(['idle', 'uptodate', 'error']);

export const checkForUpdatesNow = (): void => {
  openSettings({ scope: 'app', section: 'updates', door: true });
  const state = useAppStore.getState();
  if (!CHECKABLE_STATUSES.has(state.updaterStatus)) {
    return;
  }
  void state.checkForUpdates();
};
