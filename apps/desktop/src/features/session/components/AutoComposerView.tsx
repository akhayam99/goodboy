import { Button, Chip, FormActions } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { Docked } from '../../../shared/components/Docked';
import { PromptField } from '../../../shared/components/PromptField';
import { RoutingPicker } from '../../../shared/components/RoutingPicker';
import type { usePromptFiles } from '../../../shared/hooks/usePromptFiles';
import type { AgentRoutingChoice } from '../hooks/useAgentRouting';

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

export const AutoComposerView = ({
  goal,
  promptFiles,
  connected,
  choice,
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
  return (
    <>
      <section aria-label="Auto" className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-label text-foreground">Auto</span>
          <Chip tone="warning" kind="state" shape="badge" label="Experimental" />
          <span className="text-meta text-muted-foreground">It may not work well yet.</span>
        </div>
        <PromptField
          kind="message"
          label="Describe the work"
          value={goal}
          onChange={onGoalChange}
          onSubmit={onSubmit}
          isSubmitBlocked={!hasGoal || isStarting}
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
            disabled={isStarting}
            overridden={choice.routing !== null}
            onReset={choice.reset}
            onChange={choice.pick}
          />
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
          reason={hasGoal ? null : EMPTY_REASON}
        >
          <Button
            size="md"
            onClick={onSubmit}
            disabled={!hasGoal || isStarting}
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
