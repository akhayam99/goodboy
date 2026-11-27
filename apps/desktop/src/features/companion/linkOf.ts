import type { BridgeHint, BridgeStatus, PairedPhone } from './bridge';
import { phoneStateOf } from './phoneStateOf';

export type LinkState = 'none' | 'live' | 'offline' | 'fault';

export type Link = {
  readonly state: LinkState;
  readonly phone: PairedPhone | null;
};

type Params = {
  readonly status: BridgeStatus | null;
  readonly phones: ReadonlyArray<PairedPhone>;
  readonly hint: BridgeHint | null;
};

type SeenParams = {
  readonly phone: PairedPhone;
};

const seenAt = ({ phone }: SeenParams): number => {
  const at = phone.lastSeen === null ? Number.NaN : Date.parse(phone.lastSeen);
  return Number.isNaN(at) ? 0 : at;
};

export const linkOf = ({ status, phones, hint }: Params): Link => {
  const sorted = [...phones].sort((a, b) => seenAt({ phone: b }) - seenAt({ phone: a }));
  const live = sorted.find((phone) => phoneStateOf({ phone }) === 'live');
  const phone = live ?? sorted[0] ?? null;
  const fault = status?.fault ?? hint?.fault ?? null;
  if (phone === null) {
    const hasPrior = (hint?.priorPhoneCount ?? 0) > 0;
    return { state: fault !== null && hasPrior ? 'fault' : 'none', phone: null };
  }
  if (fault !== null) {
    return { state: 'fault', phone };
  }
  return { state: live === undefined ? 'offline' : 'live', phone };
};
