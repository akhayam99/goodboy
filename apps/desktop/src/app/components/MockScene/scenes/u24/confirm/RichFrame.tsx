import { Archive, Trash2 } from 'lucide-react';
import { Button, ConfirmPopover } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { ConfirmFrame } from './ConfirmFrame';
import { ConfirmRow } from './ConfirmRow';
import { settle } from './variants';

export const RichFrame = () => (
  <ConfirmFrame name="Workspace">
    <ConfirmRow label="Cascadia" meta="4 projects">
      <ConfirmPopover
        role="danger"
        icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
        title="Disconnect Cascadia?"
        description="Stops 2 active sessions and removes the workspace from this device."
        confirmLabel="Disconnect"
        width="w-96"
        altAction={{
          label: 'Archive instead',
          icon: <Archive size={ICON_SIZE.row} aria-hidden />,
          onClick: () => undefined,
        }}
        note={<p className="text-meta text-muted-foreground">Your repositories are not touched.</p>}
        onConfirm={settle}
        trigger={({ isArmed, arm }) => (
          <Button
            size="sm"
            variant="ghost"
            data-confirm-trigger
            aria-expanded={isArmed}
            onClick={arm}
          >
            Disconnect
          </Button>
        )}
      >
        <ul className="flex flex-col gap-1 text-meta text-foreground">
          <li>ledger-core</li>
          <li>notify-relay</li>
          <li>payments-api</li>
        </ul>
      </ConfirmPopover>
    </ConfirmRow>
  </ConfirmFrame>
);
