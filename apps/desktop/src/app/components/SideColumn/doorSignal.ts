export type DoorSignal = {
  readonly count: number;
  readonly isWarning: boolean;
  readonly isUnread: boolean;
  readonly fact: string;
};

type TerminalParams = {
  readonly kind: 'terminal';
  readonly count: number;
  readonly inUse?: undefined;
  readonly hasDownPin?: undefined;
  readonly hasUnread?: undefined;
};

type ChatParams = {
  readonly kind: 'chat';
  readonly count: number;
  readonly hasUnread: boolean;
  readonly inUse?: undefined;
  readonly hasDownPin?: undefined;
};

type MonitoringParams = {
  readonly kind: 'monitoring';
  readonly count?: undefined;
  readonly inUse: number;
  readonly hasDownPin: boolean;
  readonly hasUnread?: undefined;
};

type Params = TerminalParams | ChatParams | MonitoringParams;

export const doorSignalOf = ({
  kind,
  count,
  inUse,
  hasDownPin,
  hasUnread,
}: Params): DoorSignal | undefined => {
  if (kind === 'terminal') {
    if (count === 0) {
      return undefined;
    }
    return { count, isWarning: false, isUnread: false, fact: `${count} running` };
  }
  if (kind === 'chat') {
    if (count > 0) {
      return { count, isWarning: false, isUnread: false, fact: `${count} running` };
    }
    if (hasUnread) {
      return { count: 0, isWarning: false, isUnread: true, fact: 'unread' };
    }
    return undefined;
  }
  if (hasDownPin) {
    return { count: inUse, isWarning: true, isUnread: false, fact: 'a pinned port is down' };
  }
  if (inUse === 0) {
    return undefined;
  }
  return { count: inUse, isWarning: false, isUnread: false, fact: `${inUse} in use` };
};
