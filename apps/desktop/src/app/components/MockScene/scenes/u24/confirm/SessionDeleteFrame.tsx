import { Trash2 } from 'lucide-react';
import { ConfirmPopover, IconButton } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { ConfirmFrame } from './ConfirmFrame';
import { ConfirmRow } from './ConfirmRow';
import { settle } from './variants';

export const SessionDeleteFrame = () => (
  <ConfirmFrame name="Session header">
    <ConfirmRow label="Speed up the payout export" meta="Northwind">
      <ConfirmPopover
        role="danger"
        icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
        title="Delete this session?"
        description="Its agents, transcripts and notes are removed. The branch stays."
        confirmLabel="Delete session"
        onConfirm={settle}
        trigger={({ isArmed, arm }) => (
          <IconButton
            icon={Trash2}
            label="Delete session"
            variant="ghost"
            data-confirm-trigger
            aria-expanded={isArmed}
            onClick={arm}
          />
        )}
      />
    </ConfirmRow>
  </ConfirmFrame>
);
