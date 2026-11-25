import { useMemo } from 'react';
import { Checkbox, Listbox, type ListboxOption } from '@goodboy/ui';
import type { RunRouteCloseness, Workflow } from '@goodboy/types';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { START_PICK_TRIGGER } from '../SessionKickoff/startPickTrigger';

type PickParams = {
  readonly next: Workflow | null;
};

type ClosenessParams = {
  readonly next: RunRouteCloseness;
};

type Props = {
  readonly presets: ReadonlyArray<Workflow>;
  readonly workflow: Workflow | null;
  readonly likely: Workflow | null;
  readonly closeness: RunRouteCloseness;
  readonly isDisabled: boolean;
  readonly onPick: (params: PickParams) => void;
  readonly onCloseness: (params: ClosenessParams) => void;
};

const AUTO = 'auto';

type AutoParams = {
  readonly presets: ReadonlyArray<Workflow>;
  readonly likely: Workflow | null;
};

const autoOptionOf = ({ presets, likely }: AutoParams): ListboxOption<string> => ({
  value: AUTO,
  label: START_KIND_COPY.auto,
  description: presets.length === 0 ? START_KIND_COPY.autoNoPresets : START_KIND_COPY.autoWhat,
  ...(likely !== null && {
    meta: (
      <span className="shrink-0 text-meta text-muted-foreground">
        {START_KIND_COPY.likelyMark({ name: likely.name })}
      </span>
    ),
  }),
});

export const StartWorkflowPill = ({
  presets,
  workflow,
  likely,
  closeness,
  isDisabled,
  onPick,
  onCloseness,
}: Props) => {
  const options = useMemo(
    (): ReadonlyArray<ListboxOption<string>> => [
      autoOptionOf({ presets, likely }),
      ...presets.map((preset) => ({
        value: preset.id,
        label: preset.name,
        ...(preset.description !== '' && { description: preset.description }),
      })),
    ],
    [likely, presets],
  );
  const shown =
    workflow !== null
      ? workflow.name
      : likely === null
        ? START_KIND_COPY.auto
        : `${START_KIND_COPY.auto} · ${START_KIND_COPY.likely({ name: likely.name })}`;

  return (
    <>
      <Listbox
        ariaLabel={START_KIND_COPY.preset}
        size="sm"
        value={workflow === null ? AUTO : workflow.id}
        options={options}
        onChange={(next) => onPick({ next: presets.find((preset) => preset.id === next) ?? null })}
        disabled={isDisabled}
        className={START_PICK_TRIGGER}
        valueLabel={
          <>
            <span className="shrink-0 text-faint-foreground">{START_KIND_COPY.preset}</span>
            <span className="min-w-0 truncate text-foreground">{shown}</span>
          </>
        }
      />
      {workflow === null ? null : (
        <Checkbox
          label={START_KIND_COPY.keepSteps}
          checked={closeness === 'follow'}
          disabled={isDisabled}
          onChange={(isChecked) => onCloseness({ next: isChecked ? 'follow' : 'adapt' })}
        />
      )}
    </>
  );
};
