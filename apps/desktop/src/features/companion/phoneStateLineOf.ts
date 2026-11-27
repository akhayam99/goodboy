import type { PairedPhone } from './bridge';
import { phoneStateTextOf } from './phoneStateTextOf';
import { phoneSyncTextOf } from './phoneSyncTextOf';

type Params = {
  readonly phone: PairedPhone;
  readonly now: number;
  readonly isFaulted: boolean;
};

export const phoneStateLineOf = ({ phone, now, isFaulted }: Params): string =>
  `${phoneStateTextOf({ phone, now, isFaulted })}. Last sync ${phoneSyncTextOf({ phone, now })}.`;
