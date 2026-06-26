import { useEffect } from 'react';
import { applyStoredZoom, zoomIn, zoomOut, zoomReset } from '../../lib/zoom';
import { writeReloadIntent } from '../../../features/workspace/windowView';
import { useAppStore } from '../../../store';

const ZOOM_ACTIONS: Record<string, () => Promise<void>> = {
  '=': zoomIn,
  '+': zoomIn,
  '-': zoomOut,
  _: zoomOut,
  '0': zoomReset,
};

export const useZoomShortcuts = (): void => {
  useEffect(() => {
    void applyStoredZoom();
    const onShortcut = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) {
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        const s = useAppStore.getState();
        if (e.shiftKey) {
          writeReloadIntent({ mode: 'fresh' });
          window.location.hash = '';
        } else if (s.currentWorkspaceId) {
          const sessionId = s.currentSessionId;
          writeReloadIntent({
            mode: 'restore',
            workspaceId: s.currentWorkspaceId,
            sessionId,
            agentId: sessionId ? (s.selectedAgentId[sessionId] ?? null) : null,
          });
        }
        window.location.reload();
        return;
      }
      const action = ZOOM_ACTIONS[e.key];
      if (!action) {
        return;
      }
      e.preventDefault();
      void action();
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);
};
