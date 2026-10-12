import type { ReactNode } from 'react';
import type { MonitorProcess, PortRow } from '@goodboy/core';
import { groupPortRows } from '../../groupPortRows';
import { FreeFold } from './FreeFold';
import { SharedProcessRow } from './SharedProcessRow';

type RenderParams = {
  readonly row: PortRow;
  readonly isNested: boolean;
};

type Props = {
  readonly rows: ReadonlyArray<PortRow>;
  readonly processOf: (pid: number | null) => MonitorProcess | null;
  readonly now: number;
  readonly renderRow: (params: RenderParams) => ReactNode;
  readonly extraRows?: ReactNode;
};

export const PortGroupList = ({ rows, processOf, now, renderRow, extraRows }: Props) => {
  const { inUse, free } = groupPortRows({ rows });

  return (
    <ul className="flex flex-col">
      {inUse.map((item) =>
        item.kind === 'single' ? (
          renderRow({ row: item.row, isNested: false })
        ) : (
          <SharedProcessRow
            key={item.key}
            pid={item.pid}
            rows={item.rows}
            process={processOf(item.pid)}
            now={now}
            renderRow={renderRow}
          />
        ),
      )}
      {extraRows}
      {free.length > 0 ? <FreeFold rows={free} renderRow={renderRow} /> : null}
    </ul>
  );
};
