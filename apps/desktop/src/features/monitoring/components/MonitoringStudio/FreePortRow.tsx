import { StatusDot } from '@goodboy/ui';
import type { PortRow } from '@goodboy/core';
import { portLabel } from '../../portLabel';

type Props = {
  readonly row: PortRow;
};

export const FreePortRow = ({ row }: Props) => (
  <li
    data-port-row={row.port}
    className="flex min-h-8 items-center gap-3 px-2 text-label text-faint-foreground"
  >
    <StatusDot tone="neutral" size="md" className="opacity-40" />
    <span className="w-[4.5rem] font-mono tabular-nums">:{row.port}</span>
    <span className="min-w-0 flex-1 truncate">{portLabel({ row })}</span>
    <span>Free</span>
  </li>
);
