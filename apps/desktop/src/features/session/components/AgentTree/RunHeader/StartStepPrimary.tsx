import { TriangleAlert, Play } from 'lucide-react';
import { Button, ConfirmPopover, ICON_SIZE } from '@goodboy/ui';
import type { Session } from '@goodboy/types';

import { openAgentRevealEvent } from '../../../../../shared/utils/openAgentReveal';
import { useAppStore } from '../../../../../store';
import { useStartAnywayConfirm } from '../../../../workflows/useStartAnywayConfirm';
import type { RunView } from '../useRunView';
import type { RunPrimaryVariant } from './RunPrimaryAction';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly label: string;
  readonly variant: RunPrimaryVariant;
};

export const StartStepPrimary = ({ session, view, label, variant }: Props) => {
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
      icon={<TriangleAlert size={ICON_SIZE.row} />}
      title={start.title}
      description={start.description}
      confirmLabel={start.confirmLabel}
      cancelLabel={start.cancelLabel}
      isBusy={start.isBusy}
      isOpen={start.isConfirming}
      onConfirm={start.onConfirm}
      onCancel={start.onCancel}
      trigger={() => (
        <Button size="sm" variant={variant} isBusy={start.isBusy} onClick={start.onTrigger}>
          {isBlocked ? (
            <TriangleAlert size={ICON_SIZE.control} aria-hidden />
          ) : (
            <Play size={ICON_SIZE.control} aria-hidden />
          )}
          {label}
        </Button>
      )}
    />
  );
};
