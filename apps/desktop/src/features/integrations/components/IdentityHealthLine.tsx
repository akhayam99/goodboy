import { useState } from 'react';
import { Button, TEXT_ROLE, cn } from '@goodboy/ui';
import type { IntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { NOTHING_CHANGED } from '../../../store/slices/notifications/errorRecovery';
import { integrationLabel } from '../../../shared/utils/integrationLabel';
import { identityHealthOf } from '../identityHealthOf';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly binding: IntegrationBinding;
};

export const IdentityHealthLine = ({ workspaceId, binding }: Props) => {
  const refreshViewerIdentity = useAppStore((s) => s.refreshViewerIdentity);
  const reportError = useAppStore((s) => s.reportError);
  const [isBusy, setIsBusy] = useState(false);
  const health = identityHealthOf({
    binding: binding.provider === 'gitlab' || binding.provider === 'bitbucket' ? binding : null,
  });
  if (!health.isMissing) {
    return null;
  }
  const label = integrationLabel({ provider: binding.provider });
  const reconnect = async () => {
    setIsBusy(true);
    try {
      const outcomes = await refreshViewerIdentity({ workspaceId });
      if (outcomes.includes('failed')) {
        void reportError({
          workspaceId,
          recovery: NOTHING_CHANGED,
          title: `Couldn't read your ${label} username`,
          error: new Error(`${label} didn't confirm the account behind this key.`),
        });
      }
    } finally {
      setIsBusy(false);
    }
  };
  return (
    <p
      data-identity-health=""
      className={cn('flex min-w-0 items-center gap-2 text-meta', TEXT_ROLE.secondary)}
    >
      <span>{health.copy}</span>
      <Button
        variant="quiet"
        size="xs"
        isBusy={isBusy}
        busyLabel="Reconnecting"
        onClick={() => void reconnect()}
      >
        {health.action}
      </Button>
    </p>
  );
};
