export type MonitoringView = {
  readonly query: string;
  readonly openFolds: ReadonlyArray<string>;
};

export type MonitoringViewState = {
  readonly monitoringViews: Readonly<Record<string, MonitoringView>>;
  readonly terminalArchivedOpen: Readonly<Record<string, boolean>>;
};

export const EMPTY_MONITORING_VIEW: MonitoringView = { query: '', openFolds: [] };

export const monitoringViewInitialState: MonitoringViewState = {
  monitoringViews: {},
  terminalArchivedOpen: {},
};
