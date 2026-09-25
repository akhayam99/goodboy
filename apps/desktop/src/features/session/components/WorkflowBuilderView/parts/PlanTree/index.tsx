import type { ReactNode } from 'react';
import { Eyebrow, cn } from '@goodboy/ui';
import type { StepDraft } from '../../../../../workflows/engine';
import { AddStepRow } from './AddStepRow';
import { PlanDropZone } from './PlanDropZone';
import { PlanSkeleton } from './PlanSkeleton';
import type { PlanLaneSpan } from './PlanTreeLane';

export type PlanStepSlot = {
  readonly step: StepDraft;
  readonly index: number;
  readonly span: PlanLaneSpan;
};

type Props = {
  readonly steps: ReadonlyArray<StepDraft>;
  readonly editedCount: number;
  readonly identityIndex: number;
  readonly isPlanning: boolean;
  readonly isDragging: boolean;
  readonly dropIndex: number | null;
  readonly disabled: boolean;
  readonly banner?: ReactNode;
  readonly renderStep: (slot: PlanStepSlot) => ReactNode;
  readonly onAddStep: () => void;
};

const stepSpanOf = ({ index }: { readonly index: number }): PlanLaneSpan =>
  index === 0 ? 'origin' : 'through';

const addSpanOf = ({ count }: { readonly count: number }): PlanLaneSpan =>
  count === 0 ? 'none' : 'tip';

export const PlanTree = ({
  steps,
  editedCount,
  identityIndex,
  isPlanning,
  isDragging,
  dropIndex,
  disabled,
  banner = null,
  renderStep,
  onAddStep,
}: Props) => {
  const count = steps.length;
  const isDrafting = isPlanning && count === 0;
  return (
    <section aria-label="Plan" className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow label="Plan" muted />
        {count > 0 ? (
          <span className="flex items-center gap-1 text-2xs tabular-nums text-faint-foreground">
            <span>{`${count} step${count === 1 ? '' : 's'}`}</span>
            {editedCount > 0 ? <span>{`· ${editedCount} edited`}</span> : null}
          </span>
        ) : null}
      </div>
      {banner}
      {isDrafting ? (
        <PlanSkeleton identityIndex={identityIndex} />
      ) : (
        <ol
          aria-label="Workflow steps"
          className={cn(
            'flex flex-col-reverse motion-safe:transition-opacity',
            isPlanning && 'opacity-60',
          )}
        >
          {steps.flatMap((step, index) => [
            isDragging ? (
              <PlanDropZone
                key={`drop-${index}`}
                index={index}
                isActive={dropIndex === index}
                identityIndex={identityIndex}
              />
            ) : null,
            renderStep({ step, index, span: stepSpanOf({ index }) }),
          ])}
          {isDragging ? (
            <PlanDropZone
              key={`drop-${count}`}
              index={count}
              isActive={dropIndex === count}
              identityIndex={identityIndex}
            />
          ) : null}
          <AddStepRow
            key="add-step"
            span={addSpanOf({ count })}
            identityIndex={identityIndex}
            disabled={disabled}
            onAdd={onAddStep}
          />
        </ol>
      )}
    </section>
  );
};
