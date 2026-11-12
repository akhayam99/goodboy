import { useCallback, useEffect } from 'react';
import { applyStoredZoom, zoomIn, zoomOut, zoomReset } from '../../lib/zoom';
import { writeReloadIntent } from '../../../features/workspace/windowView';
import { reloadWhereYouAre } from '../../keyboard/reload/reloadWhereYouAre';
import { useShortcut } from '../../keyboard/useShortcut';
import { useAppStore } from '../../../store';
import { captureWindowLocation } from '../../../store/slices/navigation/captureWindowLocation';
import type { Location } from '../../../store/slices/navigation/types';

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

type Params = {
  readonly onBeforeReload: () => Promise<void>;
};

export const useWindowShortcuts = ({ onBeforeReload }: Params): void => {
  useEffect(() => {
    void applyStoredZoom();
  }, []);

  const reload = useCallback(() => {
    const s = useAppStore.getState();
    if (s.currentWorkspaceId) {
      const sessionId = s.currentSessionId;
      const location = safeCapture({ state: s });
      writeReloadIntent({
        mode: 'restore',
        workspaceId: s.currentWorkspaceId,
        sessionId,
        agentId: sessionId ? (s.selectedAgentId[sessionId] ?? null) : null,
        ...(location !== undefined && { location }),
      });
    }
    void onBeforeReload().finally(() => window.location.reload());
  }, [onBeforeReload]);

  useShortcut('zoom.in', () => void zoomIn());
  useShortcut('zoom.out', () => void zoomOut());
  useShortcut('zoom.reset', () => void zoomReset());
  useShortcut('view.reload', reloadWhereYouAre);
  useShortcut('app.reload', reload);
};
