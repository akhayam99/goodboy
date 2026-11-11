import { useWindowShortcuts } from '../../../../shared/hooks/useWindowShortcuts';
import { hideOwnedViews } from '../../hideOwnedViews';

export const useBrowserWindowShortcuts = (): void => {
  useWindowShortcuts({ onBeforeReload: hideOwnedViews });
};
