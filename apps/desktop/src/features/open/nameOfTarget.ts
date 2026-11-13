import { hostOf } from '../browser/hostOf';
import type { OpenTarget } from './types';

type Params = {
  readonly target: OpenTarget;
};

export const nameOfTarget = ({ target }: Params): string => {
  if (target.kind === 'web') {
    return hostOf({ url: target.url });
  }
  if (target.kind === 'file' || target.kind === 'folder') {
    return target.path;
  }
  return target.name;
};
