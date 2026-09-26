import {
  InteractiveRow,
  WORK_META_COLUMN,
  WORK_ROW,
  WorkNode,
  cn,
  type WorkNodeMark,
} from '@goodboy/ui';
import type { PlanPartRow as Row } from './planPartRows';
import { partRoutingLabel } from './partRoutingLabel';

type Props = {
  readonly row: Row;
  readonly hasRun: boolean;
  readonly onOpen: () => void;
};

const filesLabel = ({ count }: { readonly count: number }): string => {
  if (count === 0) {
    return '';
  }
  return count === 1 ? '1 file' : `${count} files`;
};

export const PlanPartRow = ({ row, hasRun, onOpen }: Props) => {
  const mark: WorkNodeMark = { kind: 'index', value: String(row.index + 1) };
  const doneWhen = row.doneWhen.join(' · ');

  return (
    <InteractiveRow
      label={`Part ${row.index + 1}, ${row.title}, ${row.node.label}`}
      isSelected={false}
      onOpen={onOpen}
      dataAttributes={{ 'data-plan-part': String(row.index + 1) }}
      frameClassName={WORK_ROW.container}
      className="flex min-h-9 min-w-0 items-center gap-2.5 px-2 py-1.5"
    >
      <WorkNode state={row.node.state} mark={mark} label={row.node.label} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          title={row.title}
          className={cn(
            WORK_ROW.title,
            'truncate text-body',
            row.node.state === 'queued' && hasRun ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {row.title}
        </span>
        {doneWhen.length === 0 ? null : (
          <span title={doneWhen} className="truncate text-label text-faint-foreground">
            {`Done when: ${doneWhen}`}
          </span>
        )}
      </span>
      <span
        data-testid="plan-part-meta"
        className="flex shrink-0 items-center gap-3 text-secondary tabular-nums text-muted-foreground"
      >
        <span className="w-14 shrink-0 truncate text-right @max-[520px]:hidden">
          {filesLabel({ count: row.touches.length })}
        </span>
        <span className={cn(WORK_META_COLUMN.routing, 'justify-end')}>
          <span className="min-w-0 truncate">{partRoutingLabel({ row })}</span>
        </span>
        {hasRun ? (
          <span className="w-24 shrink-0 truncate text-right @max-[640px]:hidden">
            {row.node.label}
          </span>
        ) : null}
      </span>
    </InteractiveRow>
  );
};
