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
import { PORT_GRID } from './portGrid';
import { PortRowActions } from './PortRowActions';
import { ProcessCell } from './ProcessCell';

type Props = {
  readonly row: StartedRow;
  readonly idleCounts: ReadonlyMap<number, number>;
  readonly now: number;
};

export const ProcessRowView = ({ row, idleCounts, now }: Props) => {
  const target = useMemo(() => startedTargetOf({ row }), [row]);
  const menu = useObjectMenuTrigger({ target, anchorKey: portAnchorKey({ target }) });

  return (
    <li
      data-started-row={row.spawnId}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      className={cn('group/row relative rounded-md', PORT_GRID, 'min-h-8 text-meta')}
    >
      <span aria-hidden />
      <span className="min-w-0 truncate text-faint-foreground">no port</span>
      <span className="min-w-0 truncate text-muted-foreground">{row.kindWord}</span>
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
      <span className="text-right tabular-nums text-muted-foreground">
        {formatUptime({ startedAt: row.startedAt, now })}
      </span>
      <span />
      <span className="text-right tabular-nums text-muted-foreground">
        {formatMemory({ bytes: row.rssBytes })}
      </span>
      <PortRowActions target={target} hasStop hasMenu />
    </li>
  );
};
