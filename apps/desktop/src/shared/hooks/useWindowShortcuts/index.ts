import { useCallback, useEffect } from 'react';
import { applyStoredZoom, zoomIn, zoomOut, zoomReset } from '../../lib/zoom';
import { writeReloadIntent } from '../../../features/workspace/windowView';
import { useShortcut } from '../../keyboard/useShortcut';
import { useAppStore } from '../../../store';
import { layerChain } from '../../../store/slices/navigation/layers';

export const useWindowShortcuts = (): void => {
  useEffect(() => {
    void applyStoredZoom();
  }, []);

  const reload = useCallback(() => {
    const s = useAppStore.getState();
    if (s.currentWorkspaceId) {
      const sessionId = s.currentSessionId;
      const stack = s.navigation?.[s.currentWorkspaceId];
      const layers = layerChain({ state: s, location: stack?.entries[stack.index] });
      writeReloadIntent({
        mode: 'restore',
        workspaceId: s.currentWorkspaceId,
        sessionId,
        agentId: sessionId ? (s.selectedAgentId[sessionId] ?? null) : null,
        ...(layers.length > 0 && { layers }),
      });
    }
    window.location.reload();
  }, []);

  useShortcut('zoom.in', () => void zoomIn());
  useShortcut('zoom.out', () => void zoomOut());
  useShortcut('zoom.reset', () => void zoomReset());
  useShortcut('app.reload', reload);
};
