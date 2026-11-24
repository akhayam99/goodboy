import type { PrMergeMethod } from '@goodboy/types';
import { MERGE_METHOD_LABEL } from '../../actions/kinds/pullRequest';

type Params = {
  readonly method: PrMergeMethod;
};

export const mergeHintOf = ({ method }: Params): string =>
  `${MERGE_METHOD_LABEL[method]}, in this order. You merge: Goodboy never merges on its own.`;
