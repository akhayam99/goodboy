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
  readonly downPins?: undefined;
  readonly hasUnread?: undefined;
  readonly reasons?: undefined;
};

type ChatParams = {
  readonly kind: 'chat';
  readonly count: number;
  readonly hasUnread: boolean;
  readonly inUse?: undefined;
  readonly downPins?: undefined;
  readonly reasons?: undefined;
};

type MonitoringParams = {
  readonly kind: 'monitoring';
  readonly count?: undefined;
  readonly inUse: number;
  readonly downPins: ReadonlyArray<number>;
  readonly hasUnread?: undefined;
  readonly reasons?: undefined;
};

type BoardParams = {
  readonly kind: 'board';
  readonly count: number;
  readonly reasons: ReadonlyArray<string>;
  readonly inUse?: undefined;
  readonly downPins?: undefined;
  readonly hasUnread?: undefined;
};

type Params = TerminalParams | ChatParams | MonitoringParams | BoardParams;

export const doorSignalOf = ({
  kind,
  count,
  inUse,
  downPins,
  hasUnread,
  reasons,
}: Params): DoorSignal | undefined => {
  if (kind === 'board') {
    if (count === 0) {
      return undefined;
    }
    const needYou = `${count} ${count === 1 ? 'needs' : 'need'} you`;
    const fact = reasons.length === 0 ? needYou : `${needYou}: ${reasons.join(', ')}`;
    return { count, isWarning: true, isUnread: false, fact };
  }
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
  if (downPins.length > 0) {
    const ports = downPins.map((port) => `:${port}`).join(', ');
    const fact =
      downPins.length === 1 ? `pinned port ${ports} is down` : `pinned ports ${ports} are down`;
    return { count: inUse, isWarning: true, isUnread: false, fact };
  }
  if (inUse === 0) {
    return undefined;
  }
  return { count: inUse, isWarning: false, isUnread: false, fact: `${inUse} in use` };
};
