import type { PairedPhone } from './bridge';
import { linkWordOf } from './linkWordOf';
import { phoneStateOf } from './phoneStateOf';
import { sinceTextOf } from './sinceTextOf';

type Params = {
  readonly phone: PairedPhone;
  readonly now: number;
  readonly isFaulted: boolean;
};

export const phoneStateTextOf = ({ phone, now, isFaulted }: Params): string => {
  if (isFaulted) {
    return "Can't connect";
  }
  const state = phoneStateOf({ phone });
  const word = linkWordOf({ state });
  const at = state === 'live' ? phone.liveSince : phone.lastSeen;
  if (at === null) {
    return word;
  }
  const since = sinceTextOf({ at, now });
  return since === '' ? word : `${word} since ${since}`;
};
