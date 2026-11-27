import type { LinkState } from '../../linkOf';

type Tone = 'success' | 'warning' | 'danger';

type Params = {
  readonly state: LinkState;
};

export const entryToneOf = ({ state }: Params): Tone | null => {
  if (state === 'live') {
    return 'success';
  }
  if (state === 'offline') {
    return 'warning';
  }
  if (state === 'fault') {
    return 'danger';
  }
  return null;
};
