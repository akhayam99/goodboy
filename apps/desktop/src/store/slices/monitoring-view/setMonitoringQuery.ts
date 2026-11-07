import { EMPTY_MONITORING_VIEW } from './state';
import type { SetFn } from './types';

type Props = {
  readonly set: SetFn;
};

type Params = {
  readonly workspaceId: string;
  readonly query: string;
};

export const setMonitoringQuery = ({ set }: Props) => {
  return ({ workspaceId, query }: Params): void => {
    set((state) => {
      const view = state.monitoringViews[workspaceId] ?? EMPTY_MONITORING_VIEW;
      return {
        monitoringViews: { ...state.monitoringViews, [workspaceId]: { ...view, query } },
      };
    });
  };
};
