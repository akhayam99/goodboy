import { Dialog } from '@goodboy/ui';
import { CheckCircle2 } from 'lucide-react';
import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { PROVIDER_BRAND } from '../provider-brand';
import { StatusPill } from '../ProviderLifecycleTile/StatusPill';
import { ProviderConnectPane } from '../ProviderStudio/ProviderConnectPane';

type Props = {
  readonly providerId: ProviderId;
  readonly action: ProviderLifecycleAction;
  readonly open: boolean;
  readonly onClose: () => void;
};

export const ProviderConnectDialog = ({ providerId, action, open, onClose }: Props) => {
  const provider = useAppStore((s) => s.providers.find((candidate) => candidate.id === providerId));
  const phase = useAppStore((s) => s.providerLifecycle[providerId]?.phase ?? 'idle');
  const brand = PROVIDER_BRAND[providerId];
  const Icon = brand.icon;
  const connected = provider?.connection === 'connected';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      bodyClassName="p-0"
      title={
        <span className="inline-flex items-center gap-2">
          <Icon
            size={16}
            strokeWidth={2}
            aria-hidden
            className="shrink-0"
            style={{ color: `var(${brand.cssVar})` }}
          />
          <span className="lowercase">{provider?.label ?? providerId}</span>
          <StatusPill phase={phase} connection={provider?.connection ?? 'missing'} />
        </span>
      }
      description={
        connected ? (
          <span className="inline-flex items-center gap-1.5 text-success">
            <CheckCircle2 size={12} aria-hidden />
            <span>Connected as {provider?.identity ?? 'this account'}</span>
          </span>
        ) : (
          'Step through install and sign-in without leaving Goodboy.'
        )
      }
    >
      <ProviderConnectPane
        providerId={providerId}
        action={action}
        autoStart={open}
        chrome="modal"
        onBack={onClose}
      />
    </Dialog>
  );
};
