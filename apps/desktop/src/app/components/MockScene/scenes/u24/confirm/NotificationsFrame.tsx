import { Trash2 } from 'lucide-react';
import { Button, ConfirmPopover } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { ConfirmFrame } from './ConfirmFrame';
import { ConfirmRow } from './ConfirmRow';
import { settle } from './variants';

export const NotificationsFrame = () => (
  <ConfirmFrame name="Notifications">
    <ConfirmRow label="12 notifications from Harborline" meta="3 unseen">
      <ConfirmPopover
        role="danger"
        icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
        title="Delete 12 notifications?"
        description="They are removed from this device. Nothing is sent to Harborline."
        confirmLabel="Delete all"
        onConfirm={settle}
        trigger={({ isArmed, arm }) => (
          <Button
            size="sm"
            variant="ghost"
            data-confirm-trigger
            aria-expanded={isArmed}
            onClick={arm}
          >
            Delete all
          </Button>
        )}
      />
    </ConfirmRow>
  </ConfirmFrame>
);
