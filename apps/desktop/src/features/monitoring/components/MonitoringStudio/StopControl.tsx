import { Square } from 'lucide-react';
import { Button, ConfirmPopover, ICON_SIZE } from '@goodboy/ui';
import { useAppStore } from '../../../../store';

type Props = {
  readonly pid: number;
  readonly name: string;
  readonly folder: string | null;
  readonly spawnId: string | null;
};

export const StopControl = ({ pid, name, folder, spawnId }: Props) => {
  const progress = useAppStore((state) => state.monitorStopping[pid]);
  const stopProcess = useAppStore((state) => state.stopProcess);
  const stopGoodboyRow = useAppStore((state) => state.stopGoodboyRow);

  if (progress === 'stopping') {
    return <span className="text-meta text-faint-foreground">Stopping</span>;
  }
  if (progress === 'still-running') {
    return (
      <Button
        size="xs"
        variant="ghost-danger"
        aria-label={`Force stop ${name}`}
        onClick={() => void stopProcess({ pid, force: true })}
      >
        Force stop
      </Button>
    );
  }
  if (spawnId !== null) {
    return (
      <Button
        size="xs"
        variant="ghost"
        aria-label={`Stop ${name}`}
        onClick={() => void stopGoodboyRow({ spawnId })}
      >
        Stop
      </Button>
    );
  }
  return (
    <ConfirmPopover
      role="danger"
      icon={<Square size={ICON_SIZE.row} aria-hidden />}
      title="Goodboy did not start this process. Stop it?"
      description={folder === null ? `${name}.` : `${name} in ${folder}.`}
      confirmLabel="Stop"
      onConfirm={() => void stopProcess({ pid, force: false })}
      trigger={({ isArmed, arm }) => (
        <Button
          size="xs"
          variant="ghost"
          aria-label={`Stop ${name}`}
          aria-expanded={isArmed}
          aria-haspopup="dialog"
          onClick={arm}
        >
          Stop
        </Button>
      )}
    />
  );
};
