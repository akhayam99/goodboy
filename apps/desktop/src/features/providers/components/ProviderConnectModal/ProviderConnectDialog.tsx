import { Dialog } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { PROVIDER_BRAND } from '../provider-brand';
import { ProviderConnect } from '../ProviderConnect';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly providerId: ProviderId;
  readonly open: boolean;
  readonly onClose: () => void;
};

export const ProviderConnectDialog = ({ providerId, open, onClose }: Props) => {
  const provider = useAppStore((s) => s.providers.find((candidate) => candidate.id === providerId));
  const brand = PROVIDER_BRAND[providerId];
  const Icon = brand.icon;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      fixedHeightClass="max-h-[85vh]"
      title={
        <span className="inline-flex items-center gap-2">
          <Icon
            size={ICON_SIZE.control}
            strokeWidth={2}
            aria-hidden
            className="shrink-0"
            style={{ color: `var(${brand.cssVar})` }}
          />
          <span className="lowercase">{provider?.label ?? providerId}</span>
        </span>
      }
    >
      <ProviderConnect
        key={providerId}
        providerId={providerId}
        chrome="modal"
        autoStart={open}
        onDone={onClose}
      />
    </Dialog>
  );
};
