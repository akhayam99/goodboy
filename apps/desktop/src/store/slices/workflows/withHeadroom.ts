import type { AutoContext, HeadroomMap } from '@goodboy/core';

type Params = {
  readonly scope: AutoContext | null;
  readonly headroom: HeadroomMap | null;
};

export const withHeadroom = ({ scope, headroom }: Params): AutoContext | null =>
  scope === null || headroom === null ? scope : { ...scope, headroom };
