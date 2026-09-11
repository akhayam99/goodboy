import type { PrWriteTarget } from './types';

export const prWriteKey = ({ projectId, prNumber }: PrWriteTarget): string =>
  `${projectId}#${prNumber}`;
