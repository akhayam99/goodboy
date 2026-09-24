import { useState, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-react';
import { Button, Eyebrow, IconButton, InlineConfirm, Input, Textarea, cn } from '@goodboy/ui';
import type { AgentRole, EffortLevel, ProviderId, VerbosityLevel } from '@goodboy/types';
import type { StepDraft } from '../../../../../workflows/engine';
import { RoutingPicker } from '../../../../../../shared/components/RoutingPicker';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { WORKFLOW_ROUTING_COPY } from '../../../../../workflows/workflowRoutingCopy';
import { RoleSelect } from '../../../RoleSelect';

type Props = {
  readonly step: StepDraft;
  readonly ordinal: number;
  readonly stepCount: number;
  readonly effort: EffortLevel;
  readonly estimateNote: string | null;
  readonly recommendedProvider: ProviderId;
  readonly recommendedModel: string;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly isRoutingOverridden: boolean;
  readonly disabled: boolean;
  readonly polishing: boolean;
  readonly onName: (name: string) => void;
  readonly onRole: (role: AgentRole) => void;
  readonly onPrompt: (prompt: string) => void;
  readonly onExpectedOutput: (expectedOutput: string) => void;
  readonly onProvider: (provider: ProviderId | '') => void;
  readonly onModel: (model: string) => void;
  readonly onEffort: (effort: EffortLevel) => void;
  readonly onVerbosity: (verbosity: VerbosityLevel) => void;
  readonly onRoutingReset: () => void;
  readonly onPolish: () => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onDuplicate: () => void;
  readonly onRemove: () => void;
  readonly onDone: () => void;
};

const FIELD_ID_PREFIX = 'plan-step';

export const PlanStepEditor = ({
  step,
  ordinal,
  stepCount,
  effort,
  estimateNote,
  recommendedProvider,
  recommendedModel,
  connectedProviders,
  isRoutingOverridden,
  disabled,
  polishing,
  onName,
  onRole,
  onPrompt,
  onExpectedOutput,
  onProvider,
  onModel,
  onEffort,
  onVerbosity,
  onRoutingReset,
  onPolish,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
  onDone,
}: Props) => {
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
  const idOf = (field: string): string => `${FIELD_ID_PREFIX}-${step.key}-${field}`;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented) {
      return;
    }
    event.stopPropagation();
    onDone();
  };

  return (
    <div className="@container flex flex-col gap-3 px-3 pb-3 pt-1" onKeyDown={onKeyDown}>
      <div className="grid grid-cols-1 gap-4 @min-[560px]:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <label htmlFor={idOf('title')} className="text-2xs text-muted-foreground">
              Title
            </label>
            <Input
              id={idOf('title')}
              value={step.name}
              onChange={(event) => onName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') {
                  return;
                }
                event.preventDefault();
                document.getElementById(idOf('instruction'))?.focus();
              }}
              placeholder="step name"
              disabled={disabled}
              className="h-7 bg-background text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-2xs text-muted-foreground">Role</span>
            <RoleSelect value={step.role} onChange={onRole} disabled={disabled} />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={idOf('instruction')} className="text-2xs text-muted-foreground">
                Instruction
              </label>
              <button
                type="button"
                onClick={onPolish}
                disabled={disabled || polishing || step.prompt.trim().length === 0}
                aria-label="Polish step instruction"
                className={cn(
                  'inline-flex items-center gap-1 rounded-sm px-1 text-2xs text-faint-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
                  polishing && 'animate-border-pulse',
                )}
              >
                <CONCEPT_ICONS.enhance size={ICON_SIZE.row} aria-hidden />
                Polish
              </button>
            </div>
            <Textarea
              id={idOf('instruction')}
              value={step.prompt}
              onChange={(event) => onPrompt(event.target.value)}
              placeholder="what this agent should do…"
              autoGrow
              minRows={3}
              maxRows={7}
              disabled={disabled}
              className="resize-none bg-background text-xs leading-relaxed"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idOf('expected')} className="text-2xs text-muted-foreground">
              Expected output
            </label>
            <Textarea
              id={idOf('expected')}
              value={step.expectedOutput}
              onChange={(event) => onExpectedOutput(event.target.value)}
              placeholder="what this step hands to the next one…"
              autoGrow
              minRows={1}
              maxRows={4}
              disabled={disabled}
              aria-label="Expected output"
              className="resize-none bg-background text-xs leading-relaxed"
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow label="Model" muted />
            {isRoutingOverridden ? (
              <button
                type="button"
                onClick={onRoutingReset}
                disabled={disabled}
                className="text-2xs text-faint-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed"
              >
                {WORKFLOW_ROUTING_COPY.resetLabel}
              </button>
            ) : null}
          </div>
          <RoutingPicker
            presentation="inline"
            ariaLabel={`Routing for step ${ordinal}`}
            connectedProviders={connectedProviders}
            provider={step.provider}
            model={step.model}
            effort={{ editable: true, value: effort, onChange: onEffort }}
            recommendation={{ provider: recommendedProvider, model: recommendedModel }}
            verbosity={step.verbosity}
            onVerbosity={onVerbosity}
            disabled={disabled}
            overridden={isRoutingOverridden}
            onProvider={onProvider}
            onModel={onModel}
          />
        </div>
      </div>
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
              className="min-w-0 flex-1 truncate text-2xs tabular-nums text-faint-foreground"
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
