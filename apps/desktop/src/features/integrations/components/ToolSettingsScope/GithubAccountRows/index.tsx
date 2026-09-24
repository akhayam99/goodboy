import { useEffect, useState } from 'react';
import { Eyebrow, RefreshIconButton } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { GithubConnection } from '../../../github/useGithubConnection';
import { AllWorkspacesRow } from './AllWorkspacesRow';
import { GhMissingNotice } from './GhMissingNotice';
import { WorkspaceRow } from './WorkspaceRow';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly connection: GithubConnection;
};

export const GithubAccountRows = ({ workspaceId, connection }: Props) => {
  const status = useAppStore((state) => state.githubStatus);
  const refreshGithubStatus = useAppStore((state) => state.refreshGithubStatus);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (status !== null) {
      return;
    }
    void refreshGithubStatus();
  }, [status, refreshGithubStatus]);

  const check = async () => {
    setIsChecking(true);
    try {
      await Promise.all([refreshGithubStatus(), connection.refresh()]);
    } finally {
      setIsChecking(false);
    }
  };

  if (status === null) {
    return <p className="text-xs text-muted-foreground">Checking the GitHub connection</p>;
  }

  if (!status.available) {
    return <GhMissingNotice />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Eyebrow label="All workspaces" muted className="flex-1" />
          <RefreshIconButton
            label="Check the GitHub connection"
            isLoading={isChecking}
            onClick={() => void check()}
            className="size-6"
          />
        </div>
        <AllWorkspacesRow status={status} />
      </div>
      <div className="flex flex-col gap-2">
        <Eyebrow label="This workspace" muted />
        <WorkspaceRow
          workspaceId={workspaceId}
          connection={connection}
          isGlobalConnected={status.mode !== 'absent'}
        />
      </div>
    </div>
  );
};
