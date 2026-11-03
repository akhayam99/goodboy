import type { PortRow } from '@goodboy/core/monitoring';
import { groupPortRows } from './groupPortRows';

type Params = {
  readonly rows: ReadonlyArray<PortRow>;
};

export const shownRowCount = ({ rows }: Params): number => groupPortRows({ rows }).inUse.length;
