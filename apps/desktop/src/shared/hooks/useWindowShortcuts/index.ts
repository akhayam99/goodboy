import { useCallback, useEffect } from 'react';
import { applyStoredZoom, zoomIn, zoomOut, zoomReset } from '../../lib/zoom';
import { writeReloadIntent } from '../../../features/workspace/windowView';
import { useShortcut } from '../../keyboard/useShortcut';
import { useAppStore } from '../../../store';
import { captureWindowLocation } from '../../../store/slices/navigation/captureWindowLocation';
import type { Location } from '../../../store/slices/navigation/types';
import { layerChain } from '../../../store/slices/navigation/layers';

const safeCapture = ({
  state,
}: {
  readonly state: ReturnType<typeof useAppStore.getState>;
}): Location | undefined => {
  try {
    return captureWindowLocation({ state });
  } catch {
    return undefined;
  }
};

export const useWindowShortcuts = (): void => {
  useEffect(() => {
    void applyStoredZoom();
  }, []);

  const reload = useCallback(() => {
    const s = useAppStore.getState();
    if (s.currentWorkspaceId) {
      const sessionId = s.currentSessionId;
      const location = safeCapture({ state: s });
      const layers = layerChain({ state: s, location });
      writeReloadIntent({
        mode: 'restore',
        workspaceId: s.currentWorkspaceId,
        sessionId,
        agentId: sessionId ? (s.selectedAgentId[sessionId] ?? null) : null,
        ...(location !== undefined && { location }),
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
