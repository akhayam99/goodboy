import type { PortColumns } from './portColumns';

export const PORT_FULL_FROM_PX = 700;

export const PORT_COMPACT_FROM_PX = 440;

type Params = {
  readonly width: number | null;
};

export const portColumnsOf = ({ width }: Params): PortColumns => {
  if (width === null || width >= PORT_FULL_FROM_PX) {
    return 'full';
  }
  return width >= PORT_COMPACT_FROM_PX ? 'compact' : 'narrow';
};
