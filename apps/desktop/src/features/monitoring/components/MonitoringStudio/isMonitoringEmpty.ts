import type { MonitoringModel } from '../../hooks/useMonitoringModel';

type Params = {
  readonly model: MonitoringModel;
};

export const isMonitoringEmpty = ({ model }: Params): boolean =>
  model.status === 'ready' && model.query === '' && model.isTrackedEmpty && model.target === null;
