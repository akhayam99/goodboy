import { useState } from 'react';
import { Unplug } from '@goodboy/ui/icons';
import { Button, ConfirmPopover, ICON_SIZE, SectionLabel } from '@goodboy/ui';

import { actionIntentOf } from '../../../actions/actionIntentOf';
import type { PairedPhone, PhonePermissions } from '../../bridge';
import { PhoneRow } from './PhoneRow';

type SetPermissionsParams = {
  readonly phoneId: string;
  readonly permissions: PhonePermissions;
};

type RevokeParams = {
  readonly phoneId: string;
};

type Props = {
  readonly enrolled: number;
  readonly phones: ReadonlyArray<PairedPhone>;
  readonly now: number;
  readonly isFaulted: boolean;
  readonly isBusy: boolean;
  readonly onSetPermissions: (params: SetPermissionsParams) => Promise<void>;
  readonly onRevokeOne: (params: RevokeParams) => Promise<void>;
  readonly onRevokeAll: () => Promise<void>;
};

export const PairedDevices = ({
  enrolled,
  phones,
  now,
  isFaulted,
  isBusy,
  onSetPermissions,
  onRevokeOne,
  onRevokeAll,
}: Props) => {
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <section aria-label="Paired iPhones" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel label="Paired iPhones" count={enrolled} headingLevel={2} />
        {phones.length < 2 ? null : (
          <ConfirmPopover
            role="danger"
            icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
            title="Remove all paired iPhones?"
            description="Each iPhone must scan a new code to reconnect."
            confirmLabel="Remove all iPhones"
            isBusy={isBusy}
            isOpen={isConfirming}
            onConfirm={async () => {
              await onRevokeAll();
              setIsConfirming(false);
            }}
            onCancel={() => setIsConfirming(false)}
            trigger={() => (
              <Button
                variant="quiet"
                size="sm"
                intent={actionIntentOf({ verb: 'remove iphone' })}
                onClick={() => setIsConfirming(true)}
              >
                Remove all iPhones
              </Button>
            )}
          />
        )}
      </div>
      <div className="flex flex-col gap-4">
        {phones.map((phone) => (
          <PhoneRow
            key={phone.id}
            phone={phone}
            now={now}
            isFaulted={isFaulted}
            isBusy={isBusy}
            onSetPermissions={onSetPermissions}
            onRevoke={onRevokeOne}
          />
        ))}
      </div>
    </section>
  );
};
