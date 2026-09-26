import type { ReactNode } from 'react';
import { AnchoredPopover, Button, useDropdown } from '@goodboy/ui';

type Props = {
  readonly trigger: ReactNode;
  readonly agentCount: number;
  readonly onCancel: () => void;
};

export const QueuedRestartPopover = ({ trigger, agentCount, onCancel }: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'w-64', expectedHeight: 96 });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Restart queued"
      className="flex flex-col gap-2 p-3"
      trigger={
        <button type="button" onClick={dropdown.toggle} aria-expanded={dropdown.open}>
          {trigger}
        </button>
      }
    >
      <p className="text-xs text-muted-foreground">
        Goodboy restarts once {agentCount} agent{agentCount === 1 ? '' : 's'} finish.
      </p>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          onCancel();
          dropdown.close();
        }}
      >
        Cancel
      </Button>
    </AnchoredPopover>
  );
};
