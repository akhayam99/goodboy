import { useState } from 'react';
import { Button, Notice } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { ProviderInlineConnect } from '../../../providers/components/ProviderInlineConnect';

type Props = {
  readonly providerId: ProviderId;
  readonly identity?: string | null;
  readonly onRefresh: () => void;
};

export const AuthRequiredCallout = ({ providerId, identity, onRefresh }: Props) => {
  const label = PROVIDER_LABEL[providerId];
  const [isConnecting, setIsConnecting] = useState(false);
  const hasIdentity = identity !== undefined && identity !== null && identity !== '';

  return (
    <Notice
      tone="warning"
      placement="transcript"
      title={`${label} is not signed in`}
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
          <>
            <Button size="sm" variant="secondary" onClick={() => setIsConnecting(true)}>
              Connect now
            </Button>
            <Button size="sm" variant="ghost" onClick={onRefresh}>
              Refresh status
            </Button>
          </>
        )
      }
    />
  );
};
