import type { LinkState } from '../../linkOf';

type Params = {
  readonly state: LinkState;
};

export const entryWordOf = ({ state }: Params): string => {
  if (state === 'live') {
    return 'Live';
  }
  if (state === 'offline') {
    return 'Offline';
  }
  if (state === 'fault') {
    return 'Error';
  }
  return 'Not paired';
};
