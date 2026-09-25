import type { ReactNode } from 'react';
import { Eyebrow, cn } from '@goodboy/ui';
import type { StepDraft } from '../../engine';
import type { SavedStep, SavedStepGroups } from '../../savedSteps';
import { AddStepRow } from './AddStepRow';
import { StepDropZone } from './StepDropZone';
import { StepTreeSkeleton } from './StepTreeSkeleton';
import type { StepLaneSpan } from './StepTreeLane';

export type StepSlot = {
  readonly step: StepDraft;
  readonly index: number;
  readonly span: StepLaneSpan;
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
  readonly action?: ReactNode;
  readonly savedSteps: SavedStepGroups;
  readonly renderStep: (slot: StepSlot) => ReactNode;
  readonly onAddStep: (step: SavedStep | null) => void;
};

const stepSpanOf = ({ index }: { readonly index: number }): StepLaneSpan =>
  index === 0 ? 'origin' : 'through';

const addSpanOf = ({ count }: { readonly count: number }): StepLaneSpan =>
  count === 0 ? 'none' : 'tip';

export const StepTree = ({
  steps,
  editedCount,
  identityIndex,
  isPlanning,
  isDragging,
  dropIndex,
  disabled,
  banner = null,
  action = null,
  savedSteps,
  renderStep,
  onAddStep,
}: Props) => {
  const count = steps.length;
  const isDrafting = isPlanning && count === 0;
  return (
    <section aria-label="Plan" className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow label="Plan" muted />
        <span className="flex min-w-0 items-center gap-2">
          {count > 0 ? (
            <span className="flex items-center gap-1 text-2xs tabular-nums text-faint-foreground">
              <span>{`${count} step${count === 1 ? '' : 's'}`}</span>
              {editedCount > 0 ? <span>{`· ${editedCount} edited`}</span> : null}
            </span>
          ) : null}
          {action}
        </span>
      </div>
      {banner}
      {isDrafting ? (
        <StepTreeSkeleton identityIndex={identityIndex} />
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
              <StepDropZone
                key={`drop-${index}`}
                index={index}
                isActive={dropIndex === index}
                identityIndex={identityIndex}
              />
            ) : null,
            renderStep({ step, index, span: stepSpanOf({ index }) }),
          ])}
          {isDragging ? (
            <StepDropZone
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
            savedSteps={savedSteps}
            onAdd={onAddStep}
          />
        </ol>
      )}
    </section>
  );
};
