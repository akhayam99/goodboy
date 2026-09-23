import { Unplug } from 'lucide-react';
import { Button, Divider } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly enrolled: number;
  readonly revoking: boolean;
  readonly onRevoke: () => void;
};

export const PairedDevices = ({ enrolled, revoking, onRevoke }: Props) => (
  <div className="flex w-full flex-col gap-5">
    <Divider />
    <div className="flex w-full flex-col items-center gap-2.5">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-0.5 text-2xs font-semibold text-success">
        <span aria-hidden className="size-1.5 rounded-full bg-success" />
        {enrolled} paired {enrolled === 1 ? 'device' : 'devices'}
      </span>
      <Button variant="danger" emphasis="outline" size="sm" disabled={revoking} onClick={onRevoke}>
        <Unplug size={ICON_SIZE.row} aria-hidden />
        {revoking ? 'Disconnecting…' : 'Disconnect phone'}
      </Button>
    </div>
  </div>
);
