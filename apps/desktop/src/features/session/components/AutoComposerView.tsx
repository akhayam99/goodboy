import { Button, FormActions } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { Docked } from '../../../shared/components/Docked';
import { PromptField } from '../../../shared/components/PromptField';
import { RoutingPicker } from '../../../shared/components/RoutingPicker';
import type { usePromptFiles } from '../../../shared/hooks/usePromptFiles';
import type { AgentRoutingChoice } from '../hooks/useAgentRouting';
import { AutoLimitChip } from '../../auto/AutoLimitChip';
import type { AutoTreeLimitModel } from '../../auto/useAutoTreeLimit';

type PromptFiles = ReturnType<typeof usePromptFiles>;

export type AutoRoutingChoice = Pick<
  AgentRoutingChoice,
  'routing' | 'effective' | 'suggestion' | 'suggestionReason' | 'pick' | 'reset'
>;

type Props = {
  readonly goal: string;
  readonly promptFiles: PromptFiles;
  readonly connected: ReadonlyArray<ProviderId>;
  readonly choice: AutoRoutingChoice;
  readonly limit?: AutoTreeLimitModel;
  readonly isStarting: boolean;
  readonly error: string | null;
  readonly actionsHost?: HTMLElement | null;
  readonly action?: HTMLElement | null;
  readonly footerClassName?: string;
  readonly onGoalChange: (goal: string) => void;
  readonly onSubmit: () => void;
  readonly onDiscard?: () => void;
};

const EMPTY_REASON = 'Set a goal to start';
const NO_PROVIDER_REASON = 'Auto needs a connected provider. Connect one in Providers.';

type ReasonParams = {
  readonly hasProvider: boolean;
  readonly hasGoal: boolean;
};

const startReason = ({ hasProvider, hasGoal }: ReasonParams): string | null => {
  if (!hasProvider) {
    return NO_PROVIDER_REASON;
  }
  return hasGoal ? null : EMPTY_REASON;
};

export const AutoComposerView = ({
  goal,
  promptFiles,
  connected,
  choice,
  limit,
  isStarting,
  error,
  actionsHost,
  action,
  footerClassName,
  onGoalChange,
  onSubmit,
  onDiscard,
}: Props) => {
  const hasGoal = goal.trim() !== '';
  const hasProvider = connected.length > 0;
  const canStart = hasGoal && hasProvider;
  return (
    <>
      <section aria-label="Auto" className="flex min-w-0 flex-col gap-3">
        <PromptField
          kind="message"
          label="Describe the work"
          value={goal}
          onChange={onGoalChange}
          onSubmit={onSubmit}
          isSubmitBlocked={!canStart || isStarting}
          placeholder="Describe the work."
          minRows={4}
          maxRows={12}
          disabled={isStarting}
          notice={promptFiles.notice}
          files={promptFiles.files}
          keyLabels={{ send: 'start' }}
          hasChangedKeys
        />
        <div className="flex min-w-0 items-center justify-between gap-2">
          <RoutingPicker
            variant="pill"
            align="start"
            ariaLabel="Auto model"
            connectedProviders={connected}
            provider={choice.effective.provider}
            model={choice.effective.model}
            effort={{ editable: true, value: choice.effective.effort }}
            recommendation={{
              provider: choice.suggestion.provider,
              model: choice.suggestion.model,
              label: 'Suggested',
              reason: choice.suggestionReason,
            }}
            recommendationKind="auto"
            autoTrigger="resolved"
            disabled={isStarting}
            overridden={choice.routing !== null}
            onReset={choice.reset}
            onChange={choice.pick}
          />
          {limit === undefined ? null : (
            <AutoLimitChip
              usd={limit.usd}
              isFromSession={limit.isFromSession}
              isDisabled={isStarting}
              onChange={limit.change}
            />
          )}
        </div>
      </section>
      {hasGoal && onDiscard !== undefined ? (
        <Docked node={action}>
          <Button variant="ghost" size="sm" disabled={isStarting} onClick={onDiscard}>
            Discard draft
          </Button>
        </Docked>
      ) : null}
      <Docked node={actionsHost}>
        <FormActions
          {...(footerClassName !== undefined && { className: footerClassName })}
          error={error}
          reason={startReason({ hasProvider, hasGoal })}
        >
          <Button
            size="md"
            onClick={onSubmit}
            disabled={!canStart || isStarting}
            isBusy={isStarting}
            busyLabel="Starting Auto"
          >
            Start Auto
          </Button>
        </FormActions>
      </Docked>
    </>
  );
};
