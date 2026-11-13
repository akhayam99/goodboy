import { hostOf } from '../browser/hostOf';
import type { OpenTarget } from './types';

type Params = {
  readonly target: OpenTarget;
};

export const nameOfTarget = ({ target }: Params): string =>
  target.kind === 'web' ? hostOf({ url: target.url }) : target.name;
