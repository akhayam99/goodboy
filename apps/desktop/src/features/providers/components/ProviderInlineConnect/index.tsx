import { isApiProvider } from '@goodboy/core';
import { useEffect } from 'react';
import { Button, ScrollFade } from '@goodboy/ui';
import { type ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { PROVIDER_LABEL } from '../../providerLabel';
import { ProviderConnect } from '../ProviderConnect';
import { isConnectRunning } from '../ProviderConnect/isConnectRunning';
import { ProviderCredentialsSection } from '../ProviderStudio/ProviderCredentialsSection';

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
      <ScrollFade className="min-h-0 max-h-96" fadeFrom="subtle">
        <section
          aria-label={`Connect ${PROVIDER_LABEL[providerId]}`}
          className="flex flex-col gap-3 p-3"
        >
          <ProviderCredentialsSection providerId={providerId} />
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={onDone}>
              Back
            </Button>
          </div>
        </section>
      </ScrollFade>
    );
  }

  return (
    <ScrollFade className="min-h-0 max-h-96" fadeFrom="subtle">
      <div className="p-3">
        <ProviderConnect
          providerId={providerId}
          chrome="inline"
          autoStart={autoStart}
          onDone={onDone}
        />
      </div>
    </ScrollFade>
  );
};
