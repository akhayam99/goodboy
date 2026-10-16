import type { AutoTreeId } from '@goodboy/types';

type Params = {
  readonly treeId: AutoTreeId;
};

export const autoLimitOpenEvent = ({ treeId }: Params): string =>
  `goodboy:auto-limit-open:${treeId}`;
