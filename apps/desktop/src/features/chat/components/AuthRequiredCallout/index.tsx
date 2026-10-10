import { useState } from 'react';
import { Button, Notice } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { ProviderInlineConnect } from '../../../providers/components/ProviderInlineConnect';
import { useProviderHealth } from '../../../providers/hooks/useProviderHealth';

type Props = {
  readonly providerId: ProviderId;
  readonly identity?: string | null;
  readonly onRefresh: () => void;
};

export const AuthRequiredCallout = ({ providerId, identity, onRefresh }: Props) => {
  const label = PROVIDER_LABEL[providerId];
  const health = useProviderHealth({ providerId });
  const [isConnecting, setIsConnecting] = useState(false);
  const hasIdentity = identity !== undefined && identity !== null && identity !== '';
  const isRefused = health.standing === 'signed_out' || health.isBreakerOpen;

  if (!isRefused) {
    return (
      <p className="py-2 pl-4 pr-3 text-meta text-muted-foreground">{label} refused this run.</p>
    );
  }

  return (
    <Notice
      tone="warning"
      placement="transcript"
      title={`${label} refused this run`}
      body={
        (hasIdentity || isConnecting) && (
          <div className="flex flex-col gap-2">
            {hasIdentity && <p>Last known identity: {identity}</p>}
            {isConnecting && (
              <ProviderInlineConnect
                providerId={providerId}
                onDone={() => {
                  setIsConnecting(false);
                  onRefresh();
                }}
              />
            )}
          </div>
        )
      }
      actions={
        !isConnecting && (
          <Button size="sm" variant="secondary" onClick={() => setIsConnecting(true)}>
            Sign in again
          </Button>
        )
      }
    />
  );
};
