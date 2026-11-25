import { useState } from 'react';
import { Smartphone, Unplug } from '@goodboy/ui/icons';
import { Button, ConfirmPopover, ICON_SIZE, Switch } from '@goodboy/ui';

import { formatAge } from '../../../../shared/utils/time/formatAge';
import type { PairedPhone, PhonePermissions } from '../../bridge';

const PERMISSION_LABELS = [
  { key: 'canDecide', label: 'Reply and approve' },
  { key: 'canMerge', label: 'Merge pull requests' },
  { key: 'canStart', label: 'Start sessions' },
] as const satisfies ReadonlyArray<{ key: keyof PhonePermissions; label: string }>;

type SetPermissionsParams = {
  readonly phoneId: string;
  readonly permissions: PhonePermissions;
};

type RevokeParams = {
  readonly phoneId: string;
};

type Props = {
  readonly phone: PairedPhone;
  readonly now: number;
  readonly isBusy: boolean;
  readonly onSetPermissions: (params: SetPermissionsParams) => Promise<void>;
  readonly onRevoke: (params: RevokeParams) => Promise<void>;
};

type SeenParams = {
  readonly phone: PairedPhone;
  readonly now: number;
};

const seenOf = ({ phone, now }: SeenParams): string => {
  if (phone.lastSeen === null) {
    return 'Not seen yet';
  }
  return `Last seen ${formatAge({ from: phone.lastSeen, now })}`;
};

export const PhoneRow = ({ phone, now, isBusy, onSetPermissions, onRevoke }: Props) => {
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <div className="flex w-full items-start gap-3" role="group" aria-label={phone.name}>
      <Smartphone size={ICON_SIZE.control} aria-hidden className="shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-row text-foreground">{phone.name}</span>
        <span className="text-meta text-muted-foreground">
          {seenOf({ phone, now })}. Always reads sessions.
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {PERMISSION_LABELS.map(({ key, label }) => (
            <Switch
              key={key}
              label={label}
              ariaLabel={`${label} for ${phone.name}`}
              checked={phone.permissions[key]}
              disabled={isBusy}
              onChange={(next) =>
                void onSetPermissions({
                  phoneId: phone.id,
                  permissions: { ...phone.permissions, [key]: next },
                })
              }
            />
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        <ConfirmPopover
          role="danger"
          icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
          title={`Disconnect ${phone.name}?`}
          description="It must scan a new code to reconnect. Other iPhones stay paired."
          confirmLabel="Disconnect"
          isBusy={isBusy}
          isOpen={isConfirming}
          onConfirm={async () => {
            await onRevoke({ phoneId: phone.id });
            setIsConfirming(false);
          }}
          onCancel={() => setIsConfirming(false)}
          trigger={() => (
            <Button
              variant="ghost-danger"
              size="sm"
              aria-label={`Disconnect ${phone.name}`}
              onClick={() => setIsConfirming(true)}
            >
              <Unplug size={ICON_SIZE.row} aria-hidden /> Disconnect
            </Button>
          )}
        />
      </div>
    </div>
  );
};
