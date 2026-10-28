type DoorTone = 'danger' | 'warning' | 'neutral';

export type DoorSignal = {
  readonly count: number;
  readonly isWarning: boolean;
  readonly isUnread: boolean;
  readonly fact: string;
  readonly tone?: DoorTone;
  readonly countText?: string;
};

const DOOR_COUNT_CAP = 9;

type TerminalParams = {
  readonly kind: 'terminal';
  readonly count: number;
  readonly inUse?: undefined;
  readonly downPins?: undefined;
  readonly hasUnread?: undefined;
  readonly reasons?: undefined;
  readonly tone?: undefined;
  readonly quietCount?: undefined;
  readonly quietReasons?: undefined;
};

type InboxParams = {
  readonly kind: 'inbox';
  readonly count: number;
  readonly inUse?: undefined;
  readonly downPins?: undefined;
  readonly hasUnread?: undefined;
  readonly reasons?: undefined;
  readonly tone?: undefined;
  readonly quietCount?: undefined;
  readonly quietReasons?: undefined;
};

type ChatParams = {
  readonly kind: 'chat';
  readonly count: number;
  readonly hasUnread: boolean;
  readonly inUse?: undefined;
  readonly downPins?: undefined;
  readonly reasons?: undefined;
  readonly tone?: undefined;
  readonly quietCount?: undefined;
  readonly quietReasons?: undefined;
};

type MonitoringParams = {
  readonly kind: 'monitoring';
  readonly count?: undefined;
  readonly inUse: number;
  readonly downPins: ReadonlyArray<number>;
  readonly hasUnread?: undefined;
  readonly reasons?: undefined;
  readonly tone?: undefined;
  readonly quietCount?: undefined;
  readonly quietReasons?: undefined;
};

type BoardParams = {
  readonly kind: 'board';
  readonly count: number;
  readonly tone: 'danger' | 'warning' | null;
  readonly reasons: ReadonlyArray<string>;
  readonly quietCount: number;
  readonly quietReasons: ReadonlyArray<string>;
  readonly inUse?: undefined;
  readonly downPins?: undefined;
  readonly hasUnread?: undefined;
};

type Params = TerminalParams | InboxParams | ChatParams | MonitoringParams | BoardParams;

type CountTextParams = {
  readonly count: number;
};

const countTextOf = ({ count }: CountTextParams): string =>
  count > DOOR_COUNT_CAP ? `${DOOR_COUNT_CAP}+` : String(count);

type FactParams = {
  readonly lead: string;
  readonly reasons: ReadonlyArray<string>;
};

const factOf = ({ lead, reasons }: FactParams): string =>
  reasons.length === 0 ? lead : `${lead}: ${reasons.join(', ')}`;

export const doorSignalOf = ({
  kind,
  count,
  inUse,
  downPins,
  hasUnread,
  reasons,
  tone,
  quietCount,
  quietReasons,
}: Params): DoorSignal | undefined => {
  if (kind === 'board') {
    if (count === 0 && quietCount === 0) {
      return undefined;
    }
    if (count === 0) {
      return {
        count: 0,
        isWarning: false,
        isUnread: false,
        tone: 'neutral',
        fact: factOf({
          lead: `${quietCount} to look at`,
          reasons: quietReasons,
        }),
      };
    }
    return {
      count,
      isWarning: true,
      isUnread: false,
      tone: tone ?? 'warning',
      countText: countTextOf({ count }),
      fact: factOf({ lead: `${count} ${count === 1 ? 'needs' : 'need'} you`, reasons }),
    };
  }
  if (kind === 'terminal') {
    if (count === 0) {
      return undefined;
    }
    return { count, isWarning: false, isUnread: false, fact: `${count} running` };
  }
  if (kind === 'inbox') {
    if (count === 0) {
      return undefined;
    }
    return { count, isWarning: false, isUnread: true, fact: `${count} new` };
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
