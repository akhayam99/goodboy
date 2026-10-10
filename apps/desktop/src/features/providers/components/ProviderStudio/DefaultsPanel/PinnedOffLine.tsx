import { RotateCcw } from 'lucide-react';
import type { ProviderId } from '@goodboy/types';
import { Button, ConfirmPopover } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../../shared/utils/pluralize';
import { PROVIDER_LABEL } from '../../../providerLabel';

type Props = {
  readonly count: number;
  readonly total: number;
  readonly onProviderIds: ReadonlyArray<ProviderId>;
  readonly isDisabled: boolean;
  readonly onConfirm: () => Promise<void>;
};

type LeadParams = {
  readonly onProviderIds: ReadonlyArray<ProviderId>;
};

const leadOf = ({ onProviderIds }: LeadParams): string => {
  const [only] = onProviderIds;
  if (only === undefined) {
    return 'With no provider on';
  }
  if (onProviderIds.length === 1) {
    return `With ${PROVIDER_LABEL[only]} as the only provider`;
  }
  return `With ${onProviderIds.map((id) => PROVIDER_LABEL[id]).join(', ')} on`;
};

export const PinnedOffLine = ({ count, total, onProviderIds, isDisabled, onConfirm }: Props) => {
  if (count === 0) {
    return null;
  }
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <p className="min-w-0 text-label text-muted-foreground">
        {`${leadOf({ onProviderIds })}, ${count} of ${pluralize(total, 'agent')} use${count === 1 ? 's' : ''} a pin that cannot run. Auto picks apply.`}
      </p>
      <ConfirmPopover
        role="alert"
        icon={<RotateCcw size={ICON_SIZE.control} aria-hidden />}
        title={`Put ${pluralize(count, 'agent')} back to Auto?`}
        description="Auto picks the model for each."
        confirmLabel="Back to Auto"
        align="end"
        onConfirm={onConfirm}
        trigger={({ arm }) => (
          <Button variant="ghost" size="sm" disabled={isDisabled} onClick={arm}>
            {`Back to Auto for ${count === 1 ? 'that 1' : `those ${count}`}`}
          </Button>
        )}
      />
    </div>
  );
};
