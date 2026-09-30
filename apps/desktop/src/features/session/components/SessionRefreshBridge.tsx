import type { SessionId } from '@goodboy/types';
import { useCurrentSession } from '../../../store';
import { useShortcut } from '../../../shared/keyboard/useShortcut';
import { useSessionRefresh } from '../hooks/useSessionRefresh';

export const SessionRefreshBridge = () => {
  const session = useCurrentSession();
  const refresh = useSessionRefresh();

  useShortcut('session.refresh', () => {
    if (session === null || session.archivedAt != null) {
      return;
    }
    void refresh({ sessionId: session.id as SessionId });
  });

  return null;
};
