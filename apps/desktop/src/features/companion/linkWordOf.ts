import type { LinkState } from './linkOf';

type Params = {
  readonly state: LinkState;
};

export const linkWordOf = ({ state }: Params): string => {
  if (state === 'live') {
    return 'Live';
  }
  if (state === 'offline') {
    return 'Offline';
  }
  if (state === 'fault') {
    return "Pairing isn't available";
  }
  return 'Not paired';
};
