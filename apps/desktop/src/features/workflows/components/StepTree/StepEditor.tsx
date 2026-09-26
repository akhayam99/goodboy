import { useState, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Copy, Save, Trash2 } from 'lucide-react';
import { Button, IconButton, InlineConfirm } from '@goodboy/ui';
import type { AgentRole, EffortLevel, ProviderId, VerbosityLevel } from '@goodboy/types';
import type { StepDraft } from '../../engine';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { StepEditorFields } from './StepEditorFields';

type StepPolish = {
  readonly isPolishing: boolean;
  readonly onPolish: () => void;
};

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
  readonly disabled: boolean;
  readonly polish?: StepPolish;
  readonly isSavingAsStep?: boolean;
  readonly onName: (name: string) => void;
  readonly onRole: (role: AgentRole) => void;
  readonly onPrompt: (prompt: string) => void;
  readonly onExpectedOutput: (expectedOutput: string) => void;
  readonly onProvider: (provider: ProviderId | '') => void;
  readonly onModel: (model: string) => void;
  readonly onEffort: (effort: EffortLevel) => void;
  readonly onVerbosity: (verbosity: VerbosityLevel) => void;
  readonly onRoutingReset: () => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onDuplicate: () => void;
  readonly onSaveAsStep?: () => void;
  readonly onRemove: () => void;
  readonly onDone: () => void;
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
  disabled,
  polish,
  isSavingAsStep = false,
  onName,
  onRole,
  onPrompt,
  onExpectedOutput,
  onProvider,
  onModel,
  onEffort,
  onVerbosity,
  onRoutingReset,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onSaveAsStep,
  onRemove,
  onDone,
}: Props) => {
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented) {
      return;
    }
    event.stopPropagation();
    onDone();
  };

  return (
    <div className="@container flex flex-col gap-3 px-3 pb-3 pt-1" onKeyDown={onKeyDown}>
      <StepEditorFields
        step={step}
        routingLabel={`Routing for step ${ordinal}`}
        effort={effort}
        recommendedProvider={recommendedProvider}
        recommendedModel={recommendedModel}
        connectedProviders={connectedProviders}
        isRoutingOverridden={isRoutingOverridden}
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
      />
      {isConfirmingRemove ? (
        <InlineConfirm
          role="danger"
          icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
          title={`Remove step ${ordinal}?`}
          description="Its instruction and model choice go with it."
          confirmLabel="Remove step"
          onConfirm={onRemove}
          onCancel={() => setIsConfirmingRemove(false)}
        />
      ) : (
        <div className="flex items-center justify-end gap-1">
          {estimateNote === null ? null : (
            <p
              data-testid="plan-step-estimate"
              className="min-w-0 flex-1 truncate text-secondary tabular-nums text-faint-foreground"
            >
              {estimateNote}
            </p>
          )}
          <IconButton
            icon={ArrowUp}
            label="Move step up"
            variant="ghost"
            iconSize={ICON_SIZE.control}
            onClick={onMoveUp}
            disabled={disabled || ordinal === stepCount}
          />
          <IconButton
            icon={ArrowDown}
            label="Move step down"
            variant="ghost"
            iconSize={ICON_SIZE.control}
            onClick={onMoveDown}
            disabled={disabled || ordinal === 1}
          />
          <Button variant="ghost" size="sm" onClick={onDuplicate} disabled={disabled}>
            <Copy size={ICON_SIZE.row} aria-hidden />
            Duplicate
          </Button>
          {onSaveAsStep === undefined ? null : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSaveAsStep}
              disabled={disabled || step.name.trim() === ''}
              isBusy={isSavingAsStep}
            >
              <Save size={ICON_SIZE.row} aria-hidden />
              Save as step
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsConfirmingRemove(true)}
            disabled={disabled}
            className="text-danger"
          >
            Remove
          </Button>
          <Button variant="secondary" size="sm" onClick={onDone}>
            Done
          </Button>
        </div>
      )}
    </div>
  );
};
