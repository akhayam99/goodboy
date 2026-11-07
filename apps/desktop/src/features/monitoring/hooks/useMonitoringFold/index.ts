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
  const isOpen = useAppStore((state) => state.monitoringView.openFolds.includes(foldKey));
  const toggleFold = useAppStore((state) => state.toggleMonitoringFold);
  const toggle = useCallback(() => toggleFold({ foldKey }), [toggleFold, foldKey]);
  return { isOpen, toggle };
};
