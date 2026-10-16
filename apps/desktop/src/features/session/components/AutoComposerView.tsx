import type { ReactNode } from 'react';
import { Button, FormActions } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { Docked } from '../../../shared/components/Docked';
import { PromptField } from '../../../shared/components/PromptField';
import type { usePromptFiles } from '../../../shared/hooks/usePromptFiles';
import { openSettings } from '../../settings/openSettings';
import type { AgentRoutingChoice } from '../hooks/useAgentRouting';
import { AutoLimitChip } from '../../auto/AutoLimitChip';
import type { AutoTreeLimitModel } from '../../auto/useAutoTreeLimit';
import { ModelControlChip } from '../../../shared/components/ModelControlChip';
import { START_AUTO_CHOICE } from '../../../shared/lib/startCopy';

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
  readonly projects?: ReactNode;
  readonly isStarting: boolean;
  readonly error: string | null;
  readonly actionsHost?: HTMLElement | null;
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
  limit,
  projects = null,
  isStarting,
  error,
  actionsHost,
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
      <section aria-label="Auto" className="flex min-w-0 flex-col gap-6">
        <PromptField
          kind="document"
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
        {projects}
      </section>
      <Docked node={actionsHost}>
        <div className="flex min-w-0 flex-col gap-2">
          <FormActions
            {...(footerClassName !== undefined && { className: footerClassName })}
            leading={
              <>
                <ModelControlChip
                  connectedProviders={connected}
                  effective={choice.effective}
                  suggestion={choice.suggestion}
                  suggestionReason={choice.suggestionReason}
                  recommendationKind="auto"
                  isOverridden={choice.routing !== null}
                  isDisabled={isStarting}
                  onChange={(route) => (route === null ? choice.reset() : choice.pick(route))}
                />
                {limit === undefined ? null : (
                  <AutoLimitChip
                    usd={limit.usd}
                    isFromSession={limit.isFromSession}
                    isDisabled={isStarting}
                    onChange={limit.change}
                  />
                )}
              </>
            }
            error={error}
            reason={hasProvider ? (hasGoal ? null : EMPTY_REASON) : null}
          >
            {hasGoal && onDiscard !== undefined ? (
              <Button variant="ghost" size="sm" disabled={isStarting} onClick={onDiscard}>
                Discard
              </Button>
            ) : null}
            <Button
              size={actionsHost === undefined ? 'md' : 'sm'}
              onClick={onSubmit}
              disabled={!canStart || isStarting}
              isBusy={isStarting}
              busyLabel="Starting Auto"
            >
              {START_AUTO_CHOICE}
            </Button>
          </FormActions>
          {hasProvider ? null : (
            <p className="flex flex-wrap items-center justify-end gap-1 text-meta text-faint-foreground">
              Auto needs a connected provider.
              <Button
                variant="ghost"
                size="xs"
                onClick={() => openSettings({ scope: 'providers' })}
              >
                Connect one in Providers
              </Button>
            </p>
          )}
        </div>
      </Docked>
    </>
  );
};
