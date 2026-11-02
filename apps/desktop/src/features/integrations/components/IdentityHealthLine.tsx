import { useState } from 'react';
import { Button, TEXT_ROLE, cn } from '@goodboy/ui';
import type { IntegrationBinding, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { identityHealthOf } from '../identityHealthOf';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly binding: IntegrationBinding;
};

export const IdentityHealthLine = ({ workspaceId, binding }: Props) => {
  const refreshViewerIdentity = useAppStore((s) => s.refreshViewerIdentity);
  const [isBusy, setIsBusy] = useState(false);
  const health = identityHealthOf({
    binding: binding.provider === 'gitlab' || binding.provider === 'bitbucket' ? binding : null,
  });
  if (!health.isMissing) {
    return null;
  }
  const reconnect = async () => {
    setIsBusy(true);
    await refreshViewerIdentity({ workspaceId });
    setIsBusy(false);
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
