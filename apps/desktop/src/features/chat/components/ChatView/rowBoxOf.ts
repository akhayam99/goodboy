import type { CSSProperties } from 'react';
import { rowHeightCache } from './rowHeightCache';

type Params = {
  readonly heightKey: string;
  readonly estimate: () => number;
};

type RowBox = {
  readonly className: string;
  readonly style: CSSProperties;
};

const ROW_VISIBILITY_CLASS = '[content-visibility:auto] data-row-near:[content-visibility:visible]';

export const rowBoxOf = ({ heightKey, estimate }: Params): RowBox => ({
  className: ROW_VISIBILITY_CLASS,
  style: {
    containIntrinsicSize: `auto ${rowHeightCache.read({ key: heightKey }) ?? estimate()}px`,
  },
});
