import type { CSSProperties } from 'react';

type Params = {
  readonly depth: number;
};

const INDENT_PX = 14;

const BASE_PX = 8;

export const leadTreeIndentOf = ({ depth }: Params): CSSProperties => ({
  paddingInlineStart: depth * INDENT_PX + BASE_PX,
});
