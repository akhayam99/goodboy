import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import type { PlanPartOrder } from '../../../waves/planPartOrder';
import type { PlanPartRow as Row } from '../planPartRows';
import { PlanPartBlock } from '../PlanPartBlock';

type RowParams = Readonly<{
  row: Row;
}>;

type Props = {
  readonly order: PlanPartOrder;
  readonly renderRow: (params: RowParams) => ReactNode;
};

export const PlanPartWaves = ({ order, renderRow }: Props) => (
  <div data-testid="plan-part-waves" className="flex min-w-0 flex-col gap-4">
    {order.shared.length === 0 && order.notes.length === 0 ? null : (
      <ul
        data-testid="plan-part-order"
        className="flex min-w-0 flex-col gap-1 text-meta text-muted-foreground"
      >
        {order.shared.map((line) => (
          <li key={line.path} className="min-w-0">
            <span className="break-all text-code text-foreground">{line.path}</span>
            {` ${line.rest}`}
          </li>
        ))}
        {order.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    )}
    {order.waves.map((wave) => (
      <div
        key={wave.rows[0]?.index}
        role="group"
        aria-label={wave.label}
        data-testid="plan-part-wave"
        className="flex min-w-0 flex-col gap-2"
      >
        <h3 className="text-meta text-muted-foreground">{wave.label}</h3>
        <ol
          className={cn(
            'min-w-0 gap-2',
            wave.rows.length > 1
              ? 'grid grid-cols-[repeat(auto-fit,minmax(24rem,1fr))]'
              : 'flex flex-col',
          )}
        >
          {wave.rows.map((row) => (
            <li key={row.index} className="min-w-0">
              <PlanPartBlock row={row}>{renderRow({ row })}</PlanPartBlock>
            </li>
          ))}
        </ol>
      </div>
    ))}
  </div>
);
