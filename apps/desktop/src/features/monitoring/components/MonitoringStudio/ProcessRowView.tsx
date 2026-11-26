import { useMemo } from 'react';
import { cn } from '@goodboy/ui';
import { MiddleText } from '../../../../shared/components/MiddleText';
import { portAnchorKey } from '../../../actions/portAnchorKey';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { formatMemory } from '../../formatMemory';
import { formatUptime } from '../../formatUptime';
import { MIDDLE_TAIL } from '../../middleTail';
import { startedTargetOf } from '../../portTarget';
import type { StartedRow } from '../../startedByGoodboy';
import { isStuck } from '../../stuckProcesses';
import { isPortColumnShown } from './isPortColumnShown';
import { PORT_GRIDS } from './portGrid';
import { PortRowActions } from './PortRowActions';
import { ProcessCell } from './ProcessCell';
import { usePortColumns } from './usePortColumns';

type Props = {
  readonly row: StartedRow;
  readonly idleCounts: ReadonlyMap<number, number>;
  readonly now: number;
};

export const ProcessRowView = ({ row, idleCounts, now }: Props) => {
  const target = useMemo(() => startedTargetOf({ row }), [row]);
  const menu = useObjectMenuTrigger({ target, anchorKey: portAnchorKey({ target }) });
  const columns = usePortColumns({});

  return (
    <li
      data-started-row={row.spawnId}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      className={cn('group/row relative rounded-md', PORT_GRIDS[columns], 'min-h-8 text-meta')}
    >
      <span aria-hidden />
      <span className="min-w-0 truncate text-faint-foreground">no port</span>
      {isPortColumnShown({ columns, column: 'label' }) ? (
        <span className="min-w-0 truncate text-muted-foreground">{row.kindWord}</span>
      ) : null}
      <span className="flex min-w-0 text-muted-foreground">
        <MiddleText value={row.where} tail={MIDDLE_TAIL} />
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <ProcessCell name={row.processName} pid={row.pid} />
        {isStuck({
          kind: row.kind,
          pid: row.pid,
          startedAt: row.startedAt,
          now,
          idleCounts,
        }) ? (
          <span className="shrink-0 text-meta text-warning">Looks stuck</span>
        ) : null}
      </span>
      {isPortColumnShown({ columns, column: 'up' }) ? (
        <span className="text-right tabular-nums text-muted-foreground">
          {formatUptime({ startedAt: row.startedAt, now })}
        </span>
      ) : null}
      {isPortColumnShown({ columns, column: 'cpu' }) ? <span /> : null}
      {isPortColumnShown({ columns, column: 'memory' }) ? (
        <span className="text-right tabular-nums text-muted-foreground">
          {formatMemory({ bytes: row.rssBytes })}
        </span>
      ) : null}
      <PortRowActions target={target} hasStop hasMenu />
    </li>
  );
};
