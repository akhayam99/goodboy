export type DoorSignal = {
  readonly count: number;
  readonly isWarning: boolean;
  readonly fact: string;
};

type TerminalParams = {
  readonly kind: 'terminal';
  readonly count: number;
  readonly inUse?: undefined;
  readonly hasDownPin?: undefined;
};

type MonitoringParams = {
  readonly kind: 'monitoring';
  readonly count?: undefined;
  readonly inUse: number;
  readonly hasDownPin: boolean;
};

type Params = TerminalParams | MonitoringParams;

export const doorSignalOf = ({
  kind,
  count,
  inUse,
  hasDownPin,
}: Params): DoorSignal | undefined => {
  if (kind === 'terminal') {
    if (count === 0) {
      return undefined;
    }
    return { count, isWarning: false, fact: `${count} running` };
  }
  if (hasDownPin) {
    return { count: inUse, isWarning: true, fact: 'a pinned port is down' };
  }
  if (inUse === 0) {
    return undefined;
  }
  return { count: inUse, isWarning: false, fact: `${inUse} in use` };
};
