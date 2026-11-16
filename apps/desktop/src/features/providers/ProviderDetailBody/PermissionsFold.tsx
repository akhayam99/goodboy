import { useState } from 'react';
import type { ProviderId } from '@goodboy/types';
import { Band, Disclosure } from '@goodboy/ui';
import { PROVIDER_LABEL } from '../providerLabel';
import { permissionRows } from './permissionRows';
import { PermissionsGroup } from './PermissionsGroup';

type Props = {
  readonly providerId: ProviderId;
};

export const PermissionsFold = ({ providerId }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const rows = permissionRows({ providerId });
  const fullCount = rows.filter((row) => row.verdict.isFull).length;
  const label = `What works with ${PROVIDER_LABEL[providerId]}`;
  return (
    <Band ariaLabel={label}>
      <Disclosure
        label={<span className="min-w-0 flex-1 truncate text-row text-foreground">{label}</span>}
        isOpen={isOpen}
        onToggle={() => setIsOpen((wasOpen) => !wasOpen)}
        actions={
          <span className="shrink-0 px-2 text-meta text-muted-foreground">
            {`${fullCount} of ${rows.length} work fully`}
          </span>
        }
      >
        <PermissionsGroup rows={rows} />
      </Disclosure>
    </Band>
  );
};
