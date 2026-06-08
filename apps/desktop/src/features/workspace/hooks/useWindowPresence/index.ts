import { useEffect } from 'react';
import { useAppStore } from '../../../../store';
import {
  announcePresence,
  listenPresence,
  notifyWindowClosing,
  onWindowClose,
  requestPresence,
} from '../../window';

export function useWindowPresence(): void {
  const currentWorkspaceId = useAppStore((s) => s.currentWorkspaceId);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    let unlistenClose: (() => void) | undefined;

    void (async () => {
      const off = await listenPresence({
        onPresence: (p) => useAppStore.getState().setWindowPresence(p.label, p.workspaceId),
        onRequest: () => void announcePresence(useAppStore.getState().currentWorkspaceId),
        onClosing: (label) => useAppStore.getState().removeWindowPresence(label),
      });
      if (!active) {
        off();
        return;
      }
      unlisten = off;
      await requestPresence();
    })();

    void onWindowClose(() => void notifyWindowClosing()).then((off) => {
      if (!active) {
        off();
        return;
      }
      unlistenClose = off;
    });

    return () => {
      active = false;
      unlisten?.();
      unlistenClose?.();
    };
  }, []);

  useEffect(() => {
    void announcePresence(currentWorkspaceId);
  }, [currentWorkspaceId]);
}
