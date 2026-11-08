import { useCallback } from 'react';
import { useAppStore } from '../../../../store';

type Params = {
  readonly foldKey: string;
};

type Fold = {
  readonly isOpen: boolean;
  readonly toggle: () => void;
};

export const useMonitoringFold = ({ foldKey }: Params): Fold => {
  const workspaceId = useAppStore((state) => state.currentWorkspaceId ?? '');
  const isOpen = useAppStore((state) =>
    (state.monitoringViews[workspaceId]?.openFolds ?? []).includes(foldKey),
  );
  const toggleFold = useAppStore((state) => state.toggleMonitoringFold);
  const toggle = useCallback(
    () => toggleFold({ workspaceId, foldKey }),
    [toggleFold, workspaceId, foldKey],
  );
  return { isOpen, toggle };
};
