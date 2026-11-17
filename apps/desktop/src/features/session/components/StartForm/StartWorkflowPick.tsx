import { useMemo } from 'react';
import { Checkbox, Listbox, type ListboxOption } from '@goodboy/ui';
import type { RunRouteCloseness, Workflow, WorkflowId } from '@goodboy/types';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { START_PICK_TRIGGER } from '../SessionKickoff/startPickTrigger';

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

export const StartWorkflowPick = ({
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

  if (presets.length === 0) {
    return <p className="text-meta text-muted-foreground">{START_KIND_COPY.noPresets}</p>;
  }

  return (
    <>
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
          <span className="min-w-0 truncate text-foreground">
            {preset?.name ?? START_KIND_COPY.pickPreset}
          </span>
        }
      />
      <Checkbox
        label={START_KIND_COPY.keepSteps}
        checked={closeness === 'follow'}
        disabled={isDisabled}
        onChange={(isChecked) => onCloseness({ next: isChecked ? 'follow' : 'adapt' })}
      />
    </>
  );
};
