import { hostOf } from '../browser/hostOf';
import type { OpenTarget } from './types';

type Params = {
  readonly target: OpenTarget;
};

export const nameOfTarget = ({ target }: Params): string => {
  if (target.kind === 'web') {
    return hostOf({ url: target.url });
  }
  return target.kind === 'file' ? target.path : target.name;
};
