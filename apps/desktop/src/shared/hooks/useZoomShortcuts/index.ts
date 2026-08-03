import { useCallback, useEffect } from 'react';
import { applyStoredZoom, zoomIn, zoomOut, zoomReset } from '../../lib/zoom';
import { writeReloadIntent } from '../../../features/workspace/windowView';
import { useShortcut } from '../../keyboard/useShortcut';
import { useAppStore } from '../../../store';

export const useZoomShortcuts = (): void => {
  useEffect(() => {
    void applyStoredZoom();
  }, []);

  const reload = useCallback(() => {
    const s = useAppStore.getState();
    if (s.currentWorkspaceId) {
      const sessionId = s.currentSessionId;
      writeReloadIntent({
        mode: 'restore',
        workspaceId: s.currentWorkspaceId,
        sessionId,
        agentId: sessionId ? (s.selectedAgentId[sessionId] ?? null) : null,
      });
    }
    window.location.reload();
  }, []);

  useShortcut('zoom.in', () => void zoomIn());
  useShortcut('zoom.out', () => void zoomOut());
  useShortcut('zoom.reset', () => void zoomReset());
  useShortcut('app.reload', reload);
};
