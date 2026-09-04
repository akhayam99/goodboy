import { AlertTriangle, Play } from 'lucide-react';
import { InlineConfirm } from '@goodboy/ui';
import type { WorkflowBlockReason } from '../../../../workflows/advanceGate';
import { useStartAnywayConfirm } from '../../../../workflows/useStartAnywayConfirm';
import { CardAction } from '@goodboy/ui';
import { GhostActionButton } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

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
    <div className="relative flex shrink-0 items-center">
      {variant === 'detail' ? (
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
      )}
      {start.isConfirming ? (
        <div className="absolute right-0 top-full z-popover mt-1 w-72 rounded-lg bg-background shadow-lg">
          <InlineConfirm
            role="alert"
            icon={<AlertTriangle size={ICON_SIZE.row} />}
            title={start.title}
            description={start.description}
            confirmLabel={start.confirmLabel}
            cancelLabel={start.cancelLabel}
            isBusy={start.isBusy}
            onConfirm={start.onConfirm}
            onCancel={start.onCancel}
          />
        </div>
      ) : null}
    </div>
  );
};
