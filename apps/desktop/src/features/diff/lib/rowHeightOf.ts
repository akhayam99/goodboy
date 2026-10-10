import type { TreeRow } from './changeTree';

export const ROW_PX = 28;
export const ROW_WITH_SOURCE_PX = 44;

export const rowHeightOf = (row: TreeRow): number =>
  row.kind === 'file' && row.fromPath !== null ? ROW_WITH_SOURCE_PX : ROW_PX;
