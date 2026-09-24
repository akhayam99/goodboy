import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, ConfirmPopover } from '@goodboy/ui';
import type { OpenQuestion, SessionId, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { NextAction } from '../../resolveNextAction';

type Props = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly action: Exclude<NextAction, { readonly kind: 'none' }>;
};

export const NextActionButtons = ({ sessionId, workflowRunId, action }: Props) => {
  const [isBusy, setIsBusy] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const recoverStuckStep = useAppStore((state) => state.recoverStuckStep);
  const skipStuckStepAndAdvance = useAppStore((state) => state.skipStuckStepAndAdvance);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const requestOpenQuestionScroll = useAppStore((state) => state.requestOpenQuestionScroll);
  const setActiveLens = useAppStore((state) => state.setActiveLens);

  const guard = async ({
    run,
    isCheck = false,
  }: {
    readonly run: () => Promise<void>;
    readonly isCheck?: boolean;
  }) => {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    setIsChecking(isCheck);
    try {
      await run();
    } finally {
      setIsBusy(false);
      setIsChecking(false);
    }
  };

  const answer = ({ question }: { readonly question: OpenQuestion }) => {
    if (question.createdByAgentId == null) {
      setActiveLens(sessionId, 'questions');
      return;
    }
    void selectAgent(sessionId, question.createdByAgentId);
    requestOpenQuestionScroll({ agentId: question.createdByAgentId, questionId: question.id });
    window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
  };

  switch (action.kind) {
    case 'answer':
      return (
        <Button
          size="sm"
          variant="primary"
          data-testid="next-action-answer"
          onClick={() => answer({ question: action.question })}
        >
          Answer
        </Button>
      );
    case 'recover':
      return (
        <>
          <Button
            size="sm"
            variant="primary"
            isBusy={isChecking}
            busyLabel="Checking step"
            disabled={isBusy}
            data-testid="workflow-recover-step-cta"
            title="Ask the agent to verify the work, finish anything missing, and emit the completion marker"
            onClick={() =>
              void guard({
                run: () => recoverStuckStep({ sessionId, workflowRunId }),
                isCheck: true,
              })
            }
          >
            Check completion
          </Button>
          <ConfirmPopover
            role="alert"
            icon={<AlertTriangle size={ICON_SIZE.row} />}
            title="Skip the blocked step and start the next agent?"
            description={`${action.step.name} will be marked skipped. Its output will not be carried forward.`}
            confirmLabel="Skip and continue"
            cancelLabel="Cancel"
            isBusy={isBusy}
            onConfirm={() =>
              guard({
                run: () =>
                  skipStuckStepAndAdvance(sessionId, workflowRunId, { onlyWhenBlocked: true }),
              })
            }
            trigger={({ arm }) => (
              <Button
                size="sm"
                variant="secondary"
                disabled={isBusy}
                data-testid="workflow-force-next-step-cta"
                title="Discard this step output and continue without it"
                onClick={arm}
              >
                Skip step
              </Button>
            )}
          />
        </>
      );
    case 'summarizing':
      return null;
    default: {
      const unexpected: never = action;
      return unexpected;
    }
  }
};
