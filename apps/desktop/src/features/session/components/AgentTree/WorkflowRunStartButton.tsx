import { AlertTriangle, Play } from 'lucide-react';
import { CardAction, ConfirmPopover, GhostActionButton } from '@goodboy/ui';
import type { WorkflowBlockReason } from '../../../workflows/advanceGate';
import { useStartAnywayConfirm } from '../../../workflows/useStartAnywayConfirm';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly variant: 'sidebar' | 'detail';
  readonly blockReason: WorkflowBlockReason | null;
  readonly onStart: () => void | Promise<void>;
};

export const WorkflowRunStartButton = ({ variant, blockReason, onStart }: Props) => {
  const start = useStartAnywayConfirm({
    blockReason,
    title: 'Start this workflow anyway?',
    onStart,
  });
  const isBlocked = blockReason != null;

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
      trigger={() =>
        variant === 'detail' ? (
          <GhostActionButton
            icon={isBlocked ? AlertTriangle : Play}
            label="Start"
            tone={isBlocked ? 'warning' : 'success'}
            title={isBlocked ? start.description : undefined}
            isBusy={start.isBusy}
            onClick={start.onTrigger}
          />
        ) : (
          <CardAction
            icon={isBlocked ? AlertTriangle : Play}
            label="Start workflow now"
            tone={isBlocked ? 'warning' : 'success'}
            disabled={start.isBusy}
            onClick={start.onTrigger}
          />
        )
      }
    />
  );
};
