import type { StateTone } from '@goodboy/ui';

type Params = {
  readonly state: string;
};

export const mergeRequestStateTone = ({ state }: Params): StateTone => {
  switch (state) {
    case 'opened':
      return 'success';
    case 'merged':
      return 'info';
    case 'closed':
      return 'danger';
    default:
      return 'neutral';
  }
};
