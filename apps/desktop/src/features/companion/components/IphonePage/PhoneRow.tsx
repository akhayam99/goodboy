import { useState } from 'react';
import { Smartphone, Unlink, Unplug } from '@goodboy/ui/icons';
import { Button, ConfirmPopover, ICON_SIZE, StatusMark, Switch } from '@goodboy/ui';

import { actionIntentOf } from '../../../actions/actionIntentOf';
import type { PairedPhone, PhonePermissions } from '../../bridge';
import { phoneStateLineOf } from '../../phoneStateLineOf';
import { phoneStateOf } from '../../phoneStateOf';

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
  readonly isFaulted: boolean;
  readonly isBusy: boolean;
  readonly onSetPermissions: (params: SetPermissionsParams) => Promise<void>;
  readonly onRevoke: (params: RevokeParams) => Promise<void>;
};

export const PhoneRow = ({ phone, now, isFaulted, isBusy, onSetPermissions, onRevoke }: Props) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const state = phoneStateOf({ phone });

  return (
    <div className="flex w-full items-start gap-3" role="group" aria-label={phone.name}>
      <span className="flex h-5 shrink-0 items-center text-muted-foreground">
        <Smartphone size={ICON_SIZE.control} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-row text-foreground">{phone.name}</span>
        <span className="flex items-center gap-1 text-meta text-muted-foreground">
          <StatusMark
            mark={{
              kind: 'dot',
              tone: isFaulted ? 'danger' : state === 'live' ? 'success' : 'warning',
            }}
          />
          {phoneStateLineOf({ phone, now, isFaulted })}
        </span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {PERMISSION_LABELS.map(({ key, label }) => (
            <Switch
              key={key}
              label={label}
              ariaLabel={`${label} for ${phone.name}`}
              checked={phone.permissions[key]}
              disabled={isBusy}
              onChange={(isOn) =>
                void onSetPermissions({
                  phoneId: phone.id,
                  permissions: { ...phone.permissions, [key]: isOn },
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
          title={`Remove ${phone.name}?`}
          description="It must scan a new code to reconnect. Other iPhones stay paired."
          confirmLabel="Remove"
          isBusy={isBusy}
          isOpen={isConfirming}
          onConfirm={async () => {
            await onRevoke({ phoneId: phone.id });
            setIsConfirming(false);
          }}
          onCancel={() => setIsConfirming(false)}
          trigger={() => (
            <Button
              variant="quiet"
              size="sm"
              intent={actionIntentOf({ verb: 'remove iphone' })}
              aria-label={`Remove ${phone.name}`}
              onClick={() => setIsConfirming(true)}
            >
              <Unlink size={ICON_SIZE.row} aria-hidden />
              Remove
            </Button>
          )}
        />
      </div>
    </div>
  );
};
