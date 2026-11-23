import { isApiProvider } from '@goodboy/core/providers';
import { Suspense, useEffect } from 'react';
import { Button, SkeletonRows } from '@goodboy/ui';
import { type ProviderId } from '@goodboy/types';
import { lazyNamed } from '../../../shared/lib/lazyNamed';
import { useAppStore } from '../../../store';
import { PROVIDER_LABEL } from '../providerLabel';
import { isConnectRunning } from './ProviderConnect/isConnectRunning';

const ProviderConnect = lazyNamed({
  load: () => import('./ProviderConnect'),
  pick: ({ ProviderConnect }) => ProviderConnect,
});

const ProviderCredentialsSection = lazyNamed({
  load: () => import('./ProviderStudio/ProviderCredentialsSection'),
  pick: ({ ProviderCredentialsSection }) => ProviderCredentialsSection,
});

const CONNECT_SKELETON = <SkeletonRows label="Loading connect steps" />;

type Props = {
  readonly providerId: ProviderId;
  readonly onDone: () => void;
  readonly onInFlightChange?: (isInFlight: boolean) => void;
  readonly autoStart?: boolean;
};

export const ProviderInlineConnect = ({
  providerId,
  onDone,
  onInFlightChange,
  autoStart = false,
}: Props) => {
  const phase = useAppStore((state) => state.providerConnect[providerId].phase);
  const running = isConnectRunning({ phase });

  useEffect(() => {
    onInFlightChange?.(running);
    return () => onInFlightChange?.(false);
  }, [running, onInFlightChange]);

  if (isApiProvider({ id: providerId })) {
    return (
      <section
        aria-label={`Connect ${PROVIDER_LABEL[providerId]}`}
        className="flex flex-col gap-3 p-3"
      >
        <Suspense fallback={CONNECT_SKELETON}>
          <ProviderCredentialsSection providerId={providerId} />
        </Suspense>
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={onDone}>
            Back
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="p-3">
      <Suspense fallback={CONNECT_SKELETON}>
        <ProviderConnect
          providerId={providerId}
          chrome="inline"
          autoStart={autoStart}
          onDone={onDone}
        />
      </Suspense>
    </div>
  );
};
