import { toCommandError } from '../../shared/lib/invokeCommand';

type Params = {
  readonly error: unknown;
};

export const isTabGone = ({ error }: Params): boolean =>
  toCommandError(error).message === 'tab-gone';
