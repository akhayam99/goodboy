import { TriangleAlert, Play } from 'lucide-react';
import { Button, ConfirmPopover, ICON_SIZE } from '@goodboy/ui';
import type { WorkflowBlockReason } from './advanceGate';
import { useStartAnywayConfirm } from './useStartAnywayConfirm';

type StartParams = {
  readonly isConfirmed: boolean;
};

type Props = {
  readonly label: string;
  readonly blockReason: WorkflowBlockReason | null;
  readonly variant: 'primary' | 'secondary';
  readonly title?: string;
  readonly onStart: (params: StartParams) => void | Promise<void>;
};

export const StartAnywayButton = ({ label, blockReason, variant, title, onStart }: Props) => {
  const start = useStartAnywayConfirm({ blockReason, title, onStart });
  const isBlocked = blockReason !== null;

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
