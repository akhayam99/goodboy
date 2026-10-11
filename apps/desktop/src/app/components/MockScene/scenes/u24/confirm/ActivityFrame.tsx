import { Square } from 'lucide-react';
import { Button, ConfirmPopover } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { ConfirmFrame } from './ConfirmFrame';
import { ConfirmRow } from './ConfirmRow';
import { settle } from './variants';

export const ActivityFrame = () => (
  <ConfirmFrame name="Activity">
    <ConfirmRow label="Settlement replay is running" meta="Step 2 of 4">
      <ConfirmPopover
        role="alert"
        icon={<Square size={ICON_SIZE.row} aria-hidden />}
        title="Stop this run?"
        description="The agent stops where it is. You can start it again from Activity."
        confirmLabel="Stop run"
        onConfirm={settle}
        trigger={({ isArmed, arm }) => (
          <Button
            size="sm"
            variant="ghost"
            data-confirm-trigger
            aria-expanded={isArmed}
            onClick={arm}
          >
            Stop
          </Button>
        )}
      />
    </ConfirmRow>
  </ConfirmFrame>
);
