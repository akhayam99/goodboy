import type { AutoGroupChild } from './autoGroupOf';
import { autoStuckKindOf } from './autoStuckKindOf';

type Params = {
  readonly child: Pick<AutoGroupChild, 'state' | 'isGone'>;
};

export const isAutoChildStuck = ({ child }: Params): boolean =>
  child.isGone !== true && autoStuckKindOf({ state: child.state }) !== null;
