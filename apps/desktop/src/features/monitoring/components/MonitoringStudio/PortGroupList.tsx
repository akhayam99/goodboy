import type { ReactNode } from 'react';
import type { MonitorProcess, PortRow } from '@goodboy/core';
import type { PortLayer } from '../../../actions/kinds/port';
import type { GroupedPortRows } from '../../groupPortRows';
import { SharedProcessRow } from './SharedProcessRow';

type RenderParams = {
  readonly row: PortRow;
  readonly isNested: boolean;
};

type Props = {
  readonly layer: PortLayer;
  readonly grouped: GroupedPortRows;
  readonly isFreeOpen: boolean;
  readonly processOf: (pid: number | null) => MonitorProcess | null;
  readonly now: number;
  readonly renderRow: (params: RenderParams) => ReactNode;
  readonly extraRows?: ReactNode;
};

export const PortGroupList = ({
  layer,
  grouped,
  isFreeOpen,
  processOf,
  now,
  renderRow,
  extraRows,
}: Props) => (
  <ul className="flex flex-col">
    {grouped.inUse.map((item) =>
      item.kind === 'single' ? (
        renderRow({ row: item.row, isNested: false })
      ) : (
        <SharedProcessRow
          key={item.key}
          layer={layer}
          pid={item.pid}
          rows={item.rows}
          process={processOf(item.pid)}
          now={now}
          renderRow={renderRow}
        />
      ),
    )}
    {extraRows}
    {isFreeOpen ? grouped.free.map((row) => renderRow({ row, isNested: false })) : null}
  </ul>
);
