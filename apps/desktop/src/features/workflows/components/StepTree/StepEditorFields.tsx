import { Eyebrow, Input, Textarea, cn } from '@goodboy/ui';
import type { AgentRole, EffortLevel, ProviderId, VerbosityLevel } from '@goodboy/types';
import type { StepDraft } from '../../engine';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { WORKFLOW_ROUTING_COPY } from '../../workflowRoutingCopy';
import { RoleSelect } from '../../../session/components/RoleSelect';

type StepPolish = {
  readonly isPolishing: boolean;
  readonly onPolish: () => void;
};

type Props = {
  readonly step: StepDraft;
  readonly routingLabel: string;
  readonly effort: EffortLevel;
  readonly recommendedProvider: ProviderId;
  readonly recommendedModel: string;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly isRoutingOverridden: boolean;
  readonly disabled: boolean;
  readonly polish: StepPolish | null;
  readonly onName: (name: string) => void;
  readonly onRole: (role: AgentRole) => void;
  readonly onPrompt: (prompt: string) => void;
  readonly onExpectedOutput: (expectedOutput: string) => void;
  readonly onProvider: (provider: ProviderId | '') => void;
  readonly onModel: (model: string) => void;
  readonly onEffort: (effort: EffortLevel) => void;
  readonly onVerbosity: (verbosity: VerbosityLevel) => void;
  readonly onRoutingReset: () => void;
};

const FIELD_ID_PREFIX = 'plan-step';

export const StepEditorFields = ({
  step,
  routingLabel,
  effort,
  recommendedProvider,
  recommendedModel,
  connectedProviders,
  isRoutingOverridden,
  disabled,
  polish,
  onName,
  onRole,
  onPrompt,
  onExpectedOutput,
  onProvider,
  onModel,
  onEffort,
  onVerbosity,
  onRoutingReset,
}: Props) => {
  const idOf = (field: string): string => `${FIELD_ID_PREFIX}-${step.key}-${field}`;

  return (
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
            {polish === null ? null : (
              <button
                type="button"
                onClick={polish.onPolish}
                disabled={disabled || polish.isPolishing || step.prompt.trim().length === 0}
                aria-label="Polish step instruction"
                className={cn(
                  'inline-flex items-center gap-1 rounded-sm px-1 text-2xs text-faint-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
                  polish.isPolishing && 'animate-border-pulse',
                )}
              >
                <CONCEPT_ICONS.enhance size={ICON_SIZE.row} aria-hidden />
                Polish
              </button>
            )}
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
        <div className="flex items-center justify-between gap-2 px-2.5">
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
          ariaLabel={routingLabel}
          connectedProviders={connectedProviders}
          provider={step.provider}
          model={step.model}
          effort={{ editable: true, value: effort, onChange: onEffort }}
          recommendation={{ provider: recommendedProvider, model: recommendedModel }}
          recommendationKind="auto"
          verbosity={step.verbosity}
          onVerbosity={onVerbosity}
          disabled={disabled}
          overridden={isRoutingOverridden}
          onProvider={onProvider}
          onModel={onModel}
        />
      </div>
    </div>
  );
};
