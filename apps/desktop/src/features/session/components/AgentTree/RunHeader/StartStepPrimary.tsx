import { AlertTriangle, Play } from 'lucide-react';
import { Button, ConfirmPopover } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { openAgentRevealEvent } from '../../../../../shared/utils/openAgentReveal';
import { useAppStore } from '../../../../../store';
import { useStartAnywayConfirm } from '../../../../workflows/useStartAnywayConfirm';
import type { RunView } from '../useRunView';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly label: string;
};

export const StartStepPrimary = ({ session, view, label }: Props) => {
  const activateWorkflowAgent = useAppStore((state) => state.activateWorkflowAgent);
  const agent = view.nextStepAgent;
  const start = useStartAnywayConfirm({
    blockReason: view.blockReason,
    onStart: async ({ isConfirmed }) => {
      if (agent === null) {
        return;
      }
      window.dispatchEvent(openAgentRevealEvent());
      await activateWorkflowAgent({
        sessionId: session.id,
        agentId: agent.id,
        focus: 'agent',
        bypassGate: isConfirmed,
      });
    },
  });
  const isBlocked = view.blockReason !== null;

  return (
    <ConfirmPopover
      role="alert"
      icon={<AlertTriangle size={ICON_SIZE.row} />}
      title={start.title}
      description={start.description}
      confirmLabel={start.confirmLabel}
      cancelLabel={start.cancelLabel}
      isBusy={start.isBusy}
      isOpen={start.isConfirming}
      onConfirm={start.onConfirm}
      onCancel={start.onCancel}
      trigger={() => (
        <Button size="sm" variant="primary" isBusy={start.isBusy} onClick={start.onTrigger}>
          {isBlocked ? (
            <AlertTriangle size={ICON_SIZE.control} aria-hidden />
          ) : (
            <Play size={ICON_SIZE.control} aria-hidden />
          )}
          {label}
        </Button>
      )}
    />
  );
};
