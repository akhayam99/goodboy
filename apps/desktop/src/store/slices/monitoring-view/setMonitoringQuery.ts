import type { SetFn } from './types';

type Props = {
  readonly set: SetFn;
};

type Params = {
  readonly query: string;
};

export const setMonitoringQuery = ({ set }: Props) => {
  return ({ query }: Params): void => {
    set((state) => ({ monitoringView: { ...state.monitoringView, query } }));
  };
};
