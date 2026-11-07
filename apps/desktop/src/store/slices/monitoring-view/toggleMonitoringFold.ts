import type { SetFn } from './types';

type Props = {
  readonly set: SetFn;
};

type Params = {
  readonly foldKey: string;
};

export const toggleMonitoringFold = ({ set }: Props) => {
  return ({ foldKey }: Params): void => {
    set((state) => {
      const { openFolds } = state.monitoringView;
      const next = openFolds.includes(foldKey)
        ? openFolds.filter((key) => key !== foldKey)
        : [...openFolds, foldKey];
      return { monitoringView: { ...state.monitoringView, openFolds: next } };
    });
  };
};
