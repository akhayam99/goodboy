import type { PortRow } from '@goodboy/core';
import { portLabel } from './portLabel';

type Params = {
  readonly row: PortRow;
  readonly isPinned: boolean;
};

export const portRowName = ({ row, isPinned }: Params): string => {
  const label = portLabel({ row });
  if (label !== '' || !isPinned) {
    return label;
  }
  return row.processName ?? '';
};
