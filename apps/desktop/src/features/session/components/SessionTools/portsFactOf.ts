import type { MonitoringSignal } from '../../../monitoring/monitoringSignal';

type Params = {
  readonly monitoring: MonitoringSignal | null;
};

export const portsFactOf = ({ monitoring }: Params): string | null => {
  if (monitoring === null) {
    return null;
  }
  const { inUse, downPins } = monitoring;
  const inUseFact = inUse > 0 ? `${inUse} in use` : null;
  if (downPins.length === 0) {
    return inUseFact;
  }
  const ports = downPins.map((port) => `:${port}`).join(', ');
  const down =
    downPins.length === 1 ? `pinned port ${ports} is down` : `pinned ports ${ports} are down`;
  return inUseFact === null ? down : `${inUseFact}, ${down}`;
};
