import { Eyebrow, Input, SegmentedTabs } from '@goodboy/ui';
import { PromptField } from '../../../../shared/components/PromptField';
import type { AgentRole, EffortLevel, ProviderId, VerbosityLevel } from '@goodboy/types';
import type { StepDraft } from '../../engine';
import type { PolishField, StepPolishFields } from '../../stepPolishFields';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import {
  routingLabelParts,
  routingNameText,
} from '../../../../shared/components/RoutingPicker/routingSummary';
import { RoleSelect } from '../../../session/components/RoleSelect';
import { ROLE_LABEL } from '../../../session/agent-kind';
import { VERBOSITY_LABEL, VERBOSITY_LEVELS } from '../../../settings/verbosity';
import { StepFieldLabel } from './StepFieldLabel';

type ModelSource = 'follow' | 'pin';

type Props = {
  readonly step: StepDraft;
  readonly routingLabel: string;
  readonly effort: EffortLevel;
  readonly recommendedProvider: ProviderId;
  readonly recommendedModel: string;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly isRoutingOverridden: boolean;
  readonly roleSetLine?: string | null;
  readonly disabled: boolean;
  readonly polish: StepPolishFields | null;
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
  readonly onSubmit?: () => void;
};

const FIELD_ID_PREFIX = 'plan-step';

const MODEL_SOURCES = [
  { value: 'follow', label: 'Follow role' },
  { value: 'pin', label: 'Pin a model' },
] as const satisfies ReadonlyArray<{ readonly value: ModelSource; readonly label: string }>;

const VERBOSITY_OPTIONS = VERBOSITY_LEVELS.map((level) => ({
  value: level,
  label: VERBOSITY_LABEL[level],
}));

const fieldPolish = ({
  polish,
  field,
}: {
  readonly polish: StepPolishFields | null;
  readonly field: keyof StepPolishFields;
}): PolishField | null => (polish === null ? null : polish[field]);

export const StepEditorFields = ({
  step,
  routingLabel,
  effort,
  recommendedProvider,
  recommendedModel,
  connectedProviders,
  isRoutingOverridden,
  roleSetLine = null,
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
  onPin,
  onSubmit,
}: Props) => {
  const idOf = (field: string): string => `${FIELD_ID_PREFIX}-${step.key}-${field}`;
  const source: ModelSource = isRoutingOverridden ? 'pin' : 'follow';
  const submit = onSubmit === undefined ? undefined : () => onSubmit();
  const followLabel = routingLabelParts({
    provider: recommendedProvider,
    model: recommendedModel,
    effort,
  });
  const followPick = [routingNameText(followLabel), ...followLabel.detail].join(' · ');

  return (
    <div className="grid grid-cols-1 gap-5 @min-[560px]:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={idOf('title')} className="text-secondary text-muted-foreground">
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
              className="h-7 bg-background text-label"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-secondary text-muted-foreground">Role</span>
            <RoleSelect value={step.role} onChange={onRole} disabled={disabled} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <StepFieldLabel
            htmlFor={idOf('instruction')}
            label="Instruction"
            hint="Markdown, Cmd+Enter saves"
            polish={fieldPolish({ polish, field: 'prompt' })}
            isPolishable={step.prompt.trim().length > 0}
            disabled={disabled}
          />
          <PromptField
            kind="document"
            label="Instruction"
            id={idOf('instruction')}
            value={step.prompt}
            onChange={onPrompt}
            {...(submit !== undefined && { onSubmit: submit })}
            placeholder="what this agent should do…"
            hasPreview
            minRows={3}
            maxRows={7}
            disabled={disabled}
            textClassName="text-xs leading-relaxed"
          />
        </div>
        <div className="flex flex-col gap-1">
          <StepFieldLabel
            htmlFor={idOf('expected')}
            label="Expected output"
            polish={fieldPolish({ polish, field: 'expectedOutput' })}
            isPolishable={step.expectedOutput.trim().length > 0}
            disabled={disabled}
          />
          <PromptField
            kind="document"
            label="Expected output"
            id={idOf('expected')}
            value={step.expectedOutput}
            onChange={onExpectedOutput}
            {...(submit !== undefined && { onSubmit: submit })}
            placeholder="what this step hands to the next one…"
            hasPreview
            minRows={1}
            maxRows={4}
            disabled={disabled}
            textClassName="text-xs leading-relaxed"
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="px-2.5">
          <Eyebrow label="Model" muted />
        </div>
        <div className="px-2.5">
          <SegmentedTabs
            ariaLabel="Model source"
            size="sm"
            fill
            options={MODEL_SOURCES}
            value={source}
            onChange={(next) => {
              if (disabled || next === source) {
                return;
              }
              if (next === 'follow') {
                onRoutingReset();
                return;
              }
              onPin();
            }}
          />
        </div>
        {source === 'follow' && roleSetLine !== null ? (
          <p
            data-testid="step-follows-role"
            className="px-2.5 text-secondary text-muted-foreground"
          >
            {`Follows the role: ${roleSetLine}`}
          </p>
        ) : null}
        {source === 'follow' && roleSetLine === null ? (
          <p
            data-testid="step-follows-role"
            className="px-2.5 text-secondary text-muted-foreground"
          >
            {`Follows the ${ROLE_LABEL[step.role]} role. Auto picks `}
            <span className="text-foreground">{followPick}</span>
            {' from the providers you can use now.'}
          </p>
        ) : null}
        {source === 'follow' ? null : (
          <RoutingPicker
            presentation="inline"
            providerLayout="named"
            ariaLabel={routingLabel}
            connectedProviders={connectedProviders}
            provider={step.provider}
            model={step.model}
            effort={{ editable: true, value: effort, onChange: onEffort }}
            disabled={disabled}
            overridden
            onProvider={onProvider}
            onModel={onModel}
          />
        )}
        <div className="flex min-w-0 items-center justify-between gap-3 px-2.5">
          <span className="text-secondary text-muted-foreground">Reply length</span>
          <SegmentedTabs
            ariaLabel="Reply length"
            size="xs"
            options={VERBOSITY_OPTIONS}
            value={step.verbosity}
            onChange={(next) => {
              if (disabled) {
                return;
              }
              onVerbosity(next);
            }}
          />
        </div>
      </div>
    </div>
  );
};
