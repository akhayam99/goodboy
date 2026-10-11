import {
  InteractiveRow,
  ModelBlock,
  WORK_ROW,
  WorkNode,
  cn,
  type WorkNodeMark,
  TruncatedText,
} from '@goodboy/ui';
import type { PlanPartRow as Row } from './planPartRows';
import { RoutingModelBlock } from '../../../../shared/components/RoutingModelBlock';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import type { PlanPartActionTarget } from '../../../actions/types';

type Props = {
  readonly row: Row;
  readonly hasRun: boolean;
  readonly onOpen: () => void;
  readonly target: PlanPartActionTarget;
};

const filesLabel = ({ count }: { readonly count: number }): string => {
  if (count === 0) {
    return '';
  }
  return count === 1 ? '1 file' : `${count} files`;
};

export const PlanPartRow = ({ row, hasRun, onOpen, target }: Props) => {
  const menu = useObjectMenuTrigger({
    target,
    anchorKey: `plan-part:${target.planId}:${row.index}`,
  });
  const mark: WorkNodeMark = { kind: 'index', value: String(row.index + 1) };
  const doneWhen = row.doneWhen.join(' · ');

  return (
    <InteractiveRow
      label={`Part ${row.index + 1}, ${row.title}, ${row.node.label}`}
      isSelected={false}
      onOpen={onOpen}
      menu={menu}
      dataAttributes={{ 'data-plan-part': String(row.index + 1) }}
      frameClassName={WORK_ROW.container}
      className="flex min-h-9 min-w-0 items-center gap-3 px-2 py-2"
    >
      <WorkNode state={row.node.state} mark={mark} label={row.node.label} />
      <span className="flex min-w-0 flex-1 flex-col">
        <TruncatedText
          className={cn(
            WORK_ROW.title,
            'truncate text-body',
            row.node.state === 'queued' && hasRun ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {row.title}
        </TruncatedText>
        {doneWhen.length === 0 ? null : (
          <TruncatedText tooltip={doneWhen} className="truncate text-label text-faint-foreground">
            {`Done when: ${doneWhen}`}
          </TruncatedText>
        )}
      </span>
      <span
        data-testid="plan-part-meta"
        className="flex shrink-0 items-center gap-3 text-meta tabular-nums text-muted-foreground"
      >
        <span className="w-14 shrink-0 truncate text-right @max-[520px]:hidden">
          {filesLabel({ count: row.touches.length })}
        </span>
        {row.model === null ? (
          <ModelBlock glyphs={[]} name="Auto" />
        ) : (
          <RoutingModelBlock model={row.model} effort={row.effort} />
        )}
        {hasRun ? (
          <span className="w-24 shrink-0 truncate text-right @max-[640px]:hidden">
            {row.node.label}
          </span>
        ) : null}
      </span>
    </InteractiveRow>
  );
};
