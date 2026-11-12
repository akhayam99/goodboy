import { useAppStore, useCurrentSession } from '../../../store';
import { useReloadSurface } from '../../../shared/hooks/useReloadSurface';
import { useSessionRefresh } from '../hooks/useSessionRefresh';

export const SessionRefreshBridge = () => {
  const session = useCurrentSession();
  const refresh = useSessionRefresh();
  const isOnScreen = useAppStore((state) => state.appStudio === null);

  useReloadSurface({
    isEnabled: isOnScreen && session !== null && session.archivedAt == null,
    isMain: true,
    hasNativeView: false,
    reload: () => {
      if (session === null) {
        return;
      }
      void refresh({ sessionId: session.id });
    },
  });

  return null;
};
