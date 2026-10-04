import type { KeyboardEvent } from 'react';
import { Button } from '@goodboy/ui';
import type { AgentRole, EffortLevel, ProviderId, VerbosityLevel } from '@goodboy/types';
import type { StepDraft } from '../../engine';
import type { StepPolishFields } from '../../stepPolishFields';
import { StepEditorFields } from './StepEditorFields';
import { StepEditorMenu } from './StepEditorMenu';

type Props = {
  readonly step: StepDraft;
  readonly ordinal: number;
  readonly stepCount: number;
  readonly effort: EffortLevel;
  readonly estimateNote?: string | null;
  readonly recommendedProvider: ProviderId;
  readonly recommendedModel: string;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly isRoutingOverridden: boolean;
  readonly roleSetLine?: string | null;
  readonly disabled: boolean;
  readonly polish?: StepPolishFields;
  readonly isSavingAsStep?: boolean;
  readonly doneLabel?: string;
  readonly isDoneDisabled?: boolean;
  readonly onName: (name: string) => void;
  readonly onRole: (role: AgentRole) => void;
  readonly onPrompt: (prompt: string) => void;
  readonly onExpectedOutput: (expectedOutput: string) => void;
  readonly onProvider: (provider: ProviderId | '') => void;
  readonly onModel: (model: string) => void;
  readonly onEffort: (effort: EffortLevel) => void;
  readonly onVerbosity: (verbosity: VerbosityLevel) => void;
  readonly onRoutingReset: () => void;
  readonly onPin: () => void;
  readonly onMoveUp?: () => void;
  readonly onMoveDown?: () => void;
  readonly onDuplicate?: () => void;
  readonly onSaveAsStep?: () => void;
  readonly deleteLabel?: string;
  readonly onDelete: () => void;
  readonly onDone: () => void;
  readonly onEscape?: () => void;
};

export const StepEditor = ({
  step,
  ordinal,
  stepCount,
  effort,
  estimateNote = null,
  recommendedProvider,
  recommendedModel,
  connectedProviders,
  isRoutingOverridden,
  roleSetLine = null,
  disabled,
  polish,
  isSavingAsStep = false,
  doneLabel = 'Done',
  isDoneDisabled = false,
  onName,
  onRole,
  onPrompt,
  onExpectedOutput,
  onProvider,
  onModel,
  onEffort,
  onVerbosity,
  onRoutingReset,
  onPin,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onSaveAsStep,
  deleteLabel = 'Delete step',
  onDelete,
  onDone,
  onEscape = onDone,
}: Props) => {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented) {
      return;
    }
    event.stopPropagation();
    onEscape();
  };

  return (
    <div
      className="@container flex flex-col gap-4 px-3 pb-3 pt-1"
      role="group"
      aria-label={`Edit step ${ordinal}`}
      onKeyDown={onKeyDown}
    >
      <StepEditorFields
        step={step}
        routingLabel={`Routing for step ${ordinal}`}
        effort={effort}
        recommendedProvider={recommendedProvider}
        recommendedModel={recommendedModel}
        connectedProviders={connectedProviders}
        isRoutingOverridden={isRoutingOverridden}
        roleSetLine={roleSetLine}
        disabled={disabled}
        polish={polish ?? null}
        onName={onName}
        onRole={onRole}
        onPrompt={onPrompt}
        onExpectedOutput={onExpectedOutput}
        onProvider={onProvider}
        onModel={onModel}
        onEffort={onEffort}
        onVerbosity={onVerbosity}
        onRoutingReset={onRoutingReset}
        onPin={onPin}
        onSubmit={onDone}
      />
      <div className="flex min-w-0 items-center gap-2">
        <StepEditorMenu
          ordinal={ordinal}
          stepCount={stepCount}
          disabled={disabled || isSavingAsStep}
          canSaveAsStep={step.name.trim() !== ''}
          deleteLabel={deleteLabel}
          {...(onDuplicate !== undefined && { onDuplicate })}
          {...(onSaveAsStep !== undefined && { onSaveAsStep })}
          {...(onMoveUp !== undefined && { onMoveUp })}
          {...(onMoveDown !== undefined && { onMoveDown })}
          onDelete={onDelete}
        />
        <p
          data-testid="plan-step-estimate"
          className="min-w-0 flex-1 truncate text-meta tabular-nums text-faint-foreground"
        >
          {isSavingAsStep ? 'Saving as a step' : (estimateNote ?? '')}
        </p>
        <Button variant="primary" size="sm" onClick={onDone} disabled={isDoneDisabled}>
          {doneLabel}
        </Button>
      </div>
    </div>
  );
};
