import { useEffect } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useShortcut } from '../../../../../shared/keyboard/useShortcut';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly isReadOnly: boolean;
};

export const useHistoryLiveSession = ({ sessionId, mountId, isReadOnly }: Params) => {
  const live = useAppStore((state) =>
    mountId === null ? null : (state.historyLiveSessions[mountId] ?? null),
  );
  const setHistoryLiveSession = useAppStore((state) => state.setHistoryLiveSession);
  const changeLiveHistory = useAppStore((state) => state.changeLiveHistory);
  useEffect(() => {
    if (mountId === null || isReadOnly) {
      return;
    }
    const token = crypto.randomUUID();
    setHistoryLiveSession({ sessionId, mountId, token, isOpen: true });
    return () => setHistoryLiveSession({ sessionId, mountId, token, isOpen: false });
  }, [isReadOnly, mountId, sessionId, setHistoryLiveSession]);
  const undo = (): void => {
    if (mountId !== null && !isReadOnly) {
      void changeLiveHistory({ sessionId, mountId, direction: 'undo' });
    }
  };
  const redo = (): void => {
    if (mountId !== null && !isReadOnly) {
      void changeLiveHistory({ sessionId, mountId, direction: 'redo' });
    }
  };
  useShortcut('history.undo', undo, mountId !== null && !isReadOnly);
  useShortcut('history.redo', redo, mountId !== null && !isReadOnly);
  return { live, undo, redo };
};
