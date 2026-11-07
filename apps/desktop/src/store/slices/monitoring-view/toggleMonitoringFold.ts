import { EMPTY_MONITORING_VIEW } from './state';
import type { SetFn } from './types';

type Props = {
  readonly set: SetFn;
};

type Params = {
  readonly workspaceId: string;
  readonly foldKey: string;
};

export const toggleMonitoringFold = ({ set }: Props) => {
  return ({ workspaceId, foldKey }: Params): void => {
    set((state) => {
      const view = state.monitoringViews[workspaceId] ?? EMPTY_MONITORING_VIEW;
      const openFolds = view.openFolds.includes(foldKey)
        ? view.openFolds.filter((key) => key !== foldKey)
        : [...view.openFolds, foldKey];
      return {
        monitoringViews: { ...state.monitoringViews, [workspaceId]: { ...view, openFolds } },
      };
    });
  };
};
