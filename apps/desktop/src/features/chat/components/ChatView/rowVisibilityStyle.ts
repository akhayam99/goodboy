import type { CSSProperties } from 'react';

type Params = {
  readonly px: number;
};

export const rowVisibilityStyle = ({ px }: Params): CSSProperties => ({
  contentVisibility: 'auto',
  containIntrinsicSize: `auto ${px}px`,
});
