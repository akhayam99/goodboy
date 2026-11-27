import type { PairedPhone } from './bridge';

export type PhoneState = 'live' | 'offline';

type Params = {
  readonly phone: PairedPhone;
};

export const phoneStateOf = ({ phone }: Params): PhoneState =>
  phone.liveSince === null ? 'offline' : 'live';
