export type MonitoringView = {
  readonly query: string;
  readonly openFolds: ReadonlyArray<string>;
};

export type MonitoringViewState = {
  readonly monitoringView: MonitoringView;
  readonly isTerminalArchivedOpen: boolean;
};

export const monitoringViewInitialState: MonitoringViewState = {
  monitoringView: { query: '', openFolds: [] },
  isTerminalArchivedOpen: false,
};
