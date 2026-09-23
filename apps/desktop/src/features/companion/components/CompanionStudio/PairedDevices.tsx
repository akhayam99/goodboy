import { cn as tokenCn, tintClasses as tokenTintClasses } from '@goodboy/ui';
import { useState } from 'react';
import { Smartphone, Unplug } from 'lucide-react';
import { Button, InlineConfirm } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly enrolled: number;
  readonly revoking: boolean;
  readonly onRevoke: () => Promise<void>;
  readonly onPairAnother?: () => void;
};

export const PairedDevices = ({ enrolled, revoking, onRevoke, onPairAnother }: Props) => {
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <span
        className={tokenCn(
          'inline-flex items-center gap-1.5 rounded-full',
          tokenTintClasses('success').bg,
          'px-2.5 py-0.5 text-2xs font-semibold text-success',
        )}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-success" />
        {enrolled} paired {enrolled === 1 ? 'device' : 'devices'}
      </span>
      <p className="max-w-[18rem] text-center text-2xs text-muted-foreground">
        A paired phone can send messages, start agents and workflows, and merge pull requests.
      </p>
      {isConfirming ? (
        <InlineConfirm
          role="danger"
          icon={<Unplug size={ICON_SIZE.row} />}
          title="Disconnect all paired devices?"
          description="Each phone must scan a new code to reconnect."
          confirmLabel="Disconnect"
          isBusy={revoking}
          onConfirm={async () => {
            await onRevoke();
            setIsConfirming(false);
          }}
          onCancel={() => setIsConfirming(false)}
          className="w-full max-w-[20rem]"
        />
      ) : (
        <div className="flex items-center gap-2">
          {onPairAnother !== undefined && (
            <Button variant="secondary" size="sm" onClick={onPairAnother}>
              <Smartphone size={ICON_SIZE.row} aria-hidden /> Pair another device
            </Button>
          )}
          <Button
            variant="danger"
            emphasis="outline"
            size="sm"
            onClick={() => setIsConfirming(true)}
          >
            <Unplug size={ICON_SIZE.row} aria-hidden /> Disconnect
          </Button>
        </div>
      )}
    </div>
  );
};
