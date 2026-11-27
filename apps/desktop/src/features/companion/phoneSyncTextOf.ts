import { formatAge } from '../../shared/utils/time/formatAge';
import type { PairedPhone } from './bridge';
import { phoneStateOf } from './phoneStateOf';

type Params = {
  readonly phone: PairedPhone;
  readonly now: number;
};

export const phoneSyncTextOf = ({ phone, now }: Params): string => {
  if (phoneStateOf({ phone }) === 'live') {
    return 'just now';
  }
  if (phone.lastSeen === null) {
    return 'never';
  }
  const age = formatAge({ from: phone.lastSeen, now });
  return age === '' ? 'never' : age;
};
