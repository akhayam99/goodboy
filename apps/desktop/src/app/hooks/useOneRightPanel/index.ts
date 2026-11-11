import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../../store';
import { drawerKey } from '../../../store/slices/drawer/drawerKey';
import { selectDrawerPanel } from '../../../store/slices/drawer/selectDrawerPanel';
import type { StudioDrawerSpec } from '../../../shared/components/StudioShell/studioFrameContext';

type Params = {
  readonly spec: StudioDrawerSpec | null;
  readonly isActive: boolean;
};

type Seen = {
  readonly dockKey: string | null;
  readonly panelKey: string | null;
};

export const useOneRightPanel = ({ spec, isActive }: Params): boolean => {
  const dockKey = useAppStore((state) => {
    const shown = selectDrawerPanel(state);
    return isActive && shown !== null ? drawerKey(shown) : null;
  });
  const panelKey = spec?.node == null ? null : (spec.drawerKey ?? 'panel');
  const [isPanelLatest, setIsPanelLatest] = useState(false);
  const seen = useRef<Seen>({ dockKey, panelKey });
  const closePanel = useRef(spec?.onClose);
  closePanel.current = spec?.onClose;

  useEffect(() => {
    const before = seen.current;
    seen.current = { dockKey, panelKey };
    if (panelKey !== null && panelKey !== before.panelKey) {
      setIsPanelLatest(true);
      if (dockKey !== null) {
        useAppStore.getState().closeWorkspaceTools();
      }
      return;
    }
    if (dockKey !== null && dockKey !== before.dockKey) {
      setIsPanelLatest(false);
      closePanel.current?.();
    }
  }, [dockKey, panelKey]);

  return panelKey !== null && (dockKey === null || isPanelLatest);
};
