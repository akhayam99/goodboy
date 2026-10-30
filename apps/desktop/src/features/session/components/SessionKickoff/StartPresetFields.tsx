import { useMemo } from 'react';
import { Listbox, SegmentedTabs, type ListboxOption, type SegmentedTabOption } from '@goodboy/ui';
import type { RunRouteCloseness, Workflow, WorkflowId } from '@goodboy/types';
import { AGENT_KIND_META, classifyStep } from '../../agent-kind';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { START_PICK_TRIGGER } from './startPickTrigger';

type PickParams = {
  readonly next: WorkflowId;
};

type ClosenessParams = {
  readonly next: RunRouteCloseness;
};

type Props = {
  readonly presets: ReadonlyArray<Workflow>;
  readonly presetId: WorkflowId | null;
  readonly closeness: RunRouteCloseness;
  readonly isDisabled: boolean;
  readonly onPreset: (params: PickParams) => void;
  readonly onCloseness: (params: ClosenessParams) => void;
};

const CLOSENESS_OPTIONS: ReadonlyArray<SegmentedTabOption<RunRouteCloseness>> = [
  {
    value: 'follow',
    label: START_KIND_COPY.closeness.follow,
    tooltip: START_KIND_COPY.closeness.followLine,
  },
  {
    value: 'adapt',
    label: START_KIND_COPY.closeness.adapt,
    tooltip: START_KIND_COPY.closeness.adaptLine,
  },
];

export const StartPresetFields = ({
  presets,
  presetId,
  closeness,
  isDisabled,
  onPreset,
  onCloseness,
}: Props) => {
  const options = useMemo(
    (): ReadonlyArray<ListboxOption<WorkflowId>> =>
      presets.map((preset) => ({
        value: preset.id,
        label: preset.name,
        ...(preset.description !== '' && { description: preset.description }),
      })),
    [presets],
  );
  const preset = presets.find((candidate) => candidate.id === presetId) ?? null;
  const steps = (preset?.steps ?? []).filter((step) => step.deletedAt == null);

  if (presets.length === 0) {
    return <p className="text-meta text-muted-foreground">{START_KIND_COPY.noPresets}</p>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-2" data-start-preset>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Listbox
          ariaLabel={START_KIND_COPY.preset}
          size="sm"
          value={preset === null ? null : preset.id}
          options={options}
          placeholder={START_KIND_COPY.pickPreset}
          onChange={(next) => onPreset({ next })}
          disabled={isDisabled}
          className={START_PICK_TRIGGER}
          valueLabel={
            <>
              <span className="shrink-0 text-faint-foreground">{START_KIND_COPY.preset}</span>
              <span className="min-w-0 truncate text-foreground">
                {preset?.name ?? START_KIND_COPY.pickPreset}
              </span>
            </>
          }
        />
        <SegmentedTabs
          ariaLabel={START_KIND_COPY.closeness.label}
          size="xs"
          value={closeness}
          onChange={(next) => onCloseness({ next })}
          options={CLOSENESS_OPTIONS}
        />
      </div>
      {steps.length === 0 ? null : (
        <ol aria-label={START_KIND_COPY.presetSteps} className="flex flex-col gap-1">
          {steps.map((step, index) => (
            <li key={step.id} className="flex min-w-0 items-baseline gap-2 text-meta">
              <span className="w-4 shrink-0 text-faint-foreground tabular-nums">{index + 1}</span>
              <span className="shrink-0 text-muted-foreground">
                {AGENT_KIND_META[classifyStep({ step })].noun}
              </span>
              <span className="min-w-0 truncate text-foreground">{step.name}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
