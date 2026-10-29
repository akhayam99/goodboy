import { writePushFixMemory } from './pushFixMemory';
import type { GetFn } from '../types';

type Params = {
  readonly get: GetFn;
};

export const persistPushFixes = ({ get }: Params): void =>
  writePushFixMemory({ fixes: get().branchPushFixes, outcomes: get().pushFixOutcomes });
