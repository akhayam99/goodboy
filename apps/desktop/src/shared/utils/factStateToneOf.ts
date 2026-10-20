import type { FactState, Tone } from '@goodboy/ui';

type Params = {
  readonly tone: Tone;
};

export const factStateToneOf = ({ tone }: Params): FactState['tone'] => {
  switch (tone) {
    case 'success':
      return 'ok';
    case 'info':
    case 'warning':
    case 'danger':
      return tone;
    case 'primary':
    case 'merged':
    case 'draft':
    case 'neutral':
      return 'neutral';
    default: {
      const exhaustive: never = tone;
      return exhaustive;
    }
  }
};
