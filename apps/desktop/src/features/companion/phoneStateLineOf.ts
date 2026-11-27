import { formatAge } from '../../shared/utils/time/formatAge';
import { formatClock } from '../../shared/utils/time/formatClock';
import type { PairedPhone } from './bridge';
import { phoneStateOf } from './phoneStateOf';

type Params = {
  readonly phone: PairedPhone;
  readonly now: number;
};

type SinceParams = {
  readonly state: string;
  readonly at: string | null;
};

const sinceOf = ({ state, at }: SinceParams): string => {
  if (at === null) {
    return `${state}.`;
  }
  return `${state} since ${formatClock({ at })}.`;
};

export const phoneStateLineOf = ({ phone, now }: Params): string => {
  if (phoneStateOf({ phone }) === 'live') {
    return `${sinceOf({ state: 'Live', at: phone.liveSince })} Last sync just now.`;
  }
  if (phone.lastSeen === null) {
    return 'Offline. Not seen yet.';
  }
  return `${sinceOf({ state: 'Offline', at: phone.lastSeen })} Last sync ${formatAge({ from: phone.lastSeen, now })}.`;
};
