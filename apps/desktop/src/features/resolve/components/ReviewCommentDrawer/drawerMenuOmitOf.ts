import { overflowCutOf } from '../../../actions/overflowCutOf';
import type { ResolvedAction } from '../../../actions/types';

const REACHABLE_ELSEWHERE: ReadonlyArray<string> = [
  'reviewComment.copyLink',
  'reviewComment.transcript',
  'reviewComment.openInDiff',
];

type Params = {
  readonly shown: ReadonlyArray<string>;
  readonly rare: ReadonlyArray<ResolvedAction>;
};

export const drawerMenuOmitOf = ({ shown, rare }: Params): ReadonlyArray<string> => [
  ...shown,
  ...overflowCutOf({ actions: rare, cuts: REACHABLE_ELSEWHERE }),
];
