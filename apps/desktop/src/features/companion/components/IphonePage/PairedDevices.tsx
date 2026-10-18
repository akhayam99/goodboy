import { useState } from 'react';
import { Smartphone, Unplug } from 'lucide-react';
import { Button, ConfirmPopover } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../shared/utils/pluralize';

type Props = {
  readonly enrolled: number;
  readonly isRevoking: boolean;
  readonly onRevoke: () => Promise<void>;
};

export const PairedDevices = ({ enrolled, isRevoking, onRevoke }: Props) => {
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <div className="flex w-full items-center gap-3">
      <Smartphone size={ICON_SIZE.control} aria-hidden className="shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-row text-foreground">{pluralize(enrolled, 'paired iPhone')}</span>
        <span className="text-meta text-muted-foreground">
          A paired iPhone can send messages, start agents and merge pull requests.
        </span>
      </div>
      <div className="flex shrink-0 items-center">
        <ConfirmPopover
          role="danger"
          icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
          title="Disconnect all paired devices?"
          description="Each phone must scan a new code to reconnect."
          confirmLabel="Disconnect"
          isBusy={isRevoking}
          isOpen={isConfirming}
          onConfirm={async () => {
            await onRevoke();
            setIsConfirming(false);
          }}
          onCancel={() => setIsConfirming(false)}
          trigger={() => (
            <Button variant="ghost-danger" size="sm" onClick={() => setIsConfirming(true)}>
              <Unplug size={ICON_SIZE.row} aria-hidden /> Disconnect
            </Button>
          )}
        />
      </div>
    </div>
  );
};
