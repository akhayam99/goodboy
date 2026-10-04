import { useState } from 'react';
import { MessageCircle, SkipForward } from 'lucide-react';
import { Button, ConfirmPopover, Notice } from '@goodboy/ui';
import type { Agent, SessionId, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { QuietStep } from '../../hooks/useQuietStep';
import { skipStepDescription, skipStepTitle } from '../../skipStepCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
  readonly quiet: QuietStep;
};

const MINUTE_MS = 60_000;

export const QuietStepStrip = ({ sessionId, run, agents, quiet }: Props) => {
  const askAgentToContinue = useAppStore((state) => state.askAgentToContinue);
  const skipStuckStepAndAdvance = useAppStore((state) => state.skipStuckStepAndAdvance);
  const [isBusy, setIsBusy] = useState(false);
  const minutes = Math.floor(quiet.quietMs / MINUTE_MS);
  const lastEvent = quiet.lastLabel === null ? '' : `Last event: ${quiet.lastLabel}. `;

  const guard = async (action: () => Promise<void>) => {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section aria-label={`${quiet.agent.name} has been quiet`} data-testid="quiet-step-strip">
      <Notice
        tone="warning"
        placement="inline"
        title={`No output for ${minutes} min`}
        body={`${lastEvent}${quiet.agent.name} may be stuck or waiting on a long call.`}
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              isBusy={isBusy}
              busyLabel="Asking"
              data-testid="quiet-step-ask"
              title="Send it a message to check where it stands and finish"
              onClick={() =>
                void guard(() => askAgentToContinue({ sessionId, agentId: quiet.agent.id }))
              }
            >
              <MessageCircle size={ICON_SIZE.row} aria-hidden />
              Ask it to continue
            </Button>
            <ConfirmPopover
              role="alert"
              icon={<SkipForward size={ICON_SIZE.row} aria-hidden />}
              title={skipStepTitle({ agent: quiet.agent })}
              description={skipStepDescription({ run, agent: quiet.agent, agents })}
              confirmLabel="Skip step"
              cancelLabel="Cancel"
              align="end"
              isBusy={isBusy}
              onConfirm={() =>
                guard(() =>
                  skipStuckStepAndAdvance(sessionId, run.id, {
                    force: true,
                    agentId: quiet.agent.id,
                  }),
                )
              }
              trigger={({ arm }) => (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isBusy}
                  data-testid="quiet-step-skip"
                  onClick={arm}
                >
                  Skip
                </Button>
              )}
            />
          </div>
        }
      />
    </section>
  );
};
