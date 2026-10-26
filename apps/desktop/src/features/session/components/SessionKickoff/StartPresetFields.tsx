import { useMemo } from 'react';
import { Listbox, SegmentedTabs, type ListboxOption } from '@goodboy/ui';
import type { RunRouteCloseness, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { AGENT_KIND_META, classifyStep } from '../../agent-kind';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { START_PICK_TRIGGER } from './startPickTrigger';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly isDisabled: boolean;
};

const NO_PRESETS: ReadonlyArray<Workflow> = [];

const CLOSENESS_OPTIONS: ReadonlyArray<{ value: RunRouteCloseness; label: string }> = [
  { value: 'follow', label: START_KIND_COPY.closeness.follow },
  { value: 'adapt', label: START_KIND_COPY.closeness.adapt },
];

export const StartPresetFields = ({ workspaceId, isDisabled }: Props) => {
  const templates = useAppStore((state) => state.phaseTemplates[workspaceId] ?? EMPTY_ARRAY);
  const presetId = useAppStore((state) => selectSessionDraft({ state, workspaceId }).workflowId);
  const closeness = useAppStore(
    (state) => selectSessionDraft({ state, workspaceId }).presetCloseness,
  );
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const presets = useMemo(
    () =>
      templates.length === 0
        ? NO_PRESETS
        : templates.filter((workflow) => workflow.isPreset === true),
    [templates],
  );
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
    <div className="flex flex-col gap-4" data-start-preset>
      <div className="flex flex-col gap-2">
        <div className="flex">
          <Listbox
            ariaLabel={START_KIND_COPY.preset}
            size="sm"
            value={preset === null ? null : preset.id}
            options={options}
            placeholder={START_KIND_COPY.pickPreset}
            onChange={(next) => patchSessionDraft({ workspaceId, patch: { workflowId: next } })}
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
      <div className="flex flex-col gap-2">
        <SegmentedTabs
          ariaLabel={START_KIND_COPY.closeness.label}
          size="sm"
          value={closeness}
          onChange={(next) => patchSessionDraft({ workspaceId, patch: { presetCloseness: next } })}
          options={CLOSENESS_OPTIONS}
        />
        <p className="text-meta text-muted-foreground">
          {closeness === 'follow'
            ? START_KIND_COPY.closeness.followLine
            : START_KIND_COPY.closeness.adaptLine}
        </p>
      </div>
    </div>
  );
};
