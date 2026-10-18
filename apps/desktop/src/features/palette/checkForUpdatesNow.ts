import { useAppStore } from '../../store';

const CHECKABLE_STATUSES: ReadonlySet<string> = new Set(['idle', 'uptodate', 'error']);

export const checkForUpdatesNow = (): void => {
  window.dispatchEvent(
    new CustomEvent('goodboy:open-settings', {
      detail: { scope: 'app', section: 'general', door: true },
    }),
  );
  const state = useAppStore.getState();
  if (!CHECKABLE_STATUSES.has(state.updaterStatus)) {
    return;
  }
  void state.checkForUpdates();
};
