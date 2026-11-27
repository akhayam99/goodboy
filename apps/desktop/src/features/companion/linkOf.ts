import type { BridgeStatus, PairedPhone } from './bridge';
import { phoneStateOf } from './phoneStateOf';

export type LinkState = 'none' | 'live' | 'offline' | 'fault';

export type Link = {
  readonly state: LinkState;
  readonly phone: PairedPhone | null;
};

type Params = {
  readonly status: BridgeStatus | null;
  readonly phones: ReadonlyArray<PairedPhone>;
};

type SeenParams = {
  readonly phone: PairedPhone;
};

const seenAt = ({ phone }: SeenParams): number => {
  const at = phone.lastSeen === null ? Number.NaN : Date.parse(phone.lastSeen);
  return Number.isNaN(at) ? 0 : at;
};

export const linkOf = ({ status, phones }: Params): Link => {
  const sorted = [...phones].sort((a, b) => seenAt({ phone: b }) - seenAt({ phone: a }));
  const live = sorted.find((phone) => phoneStateOf({ phone }) === 'live');
  const phone = live ?? sorted[0] ?? null;
  if ((status?.fault ?? null) !== null) {
    return { state: 'fault', phone };
  }
  if (phone === null) {
    return { state: 'none', phone: null };
  }
  return { state: live === undefined ? 'offline' : 'live', phone };
};
