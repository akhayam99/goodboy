import { useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import type { GithubConnection } from '../../../github/useGithubConnection';
import { GithubFormBody } from '../../../github/GithubFormBody';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly connection: GithubConnection;
  readonly isGlobalConnected: boolean;
};

export const WorkspaceRow = ({ workspaceId, connection, isGlobalConnected }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (connection.isScoped || isExpanded) {
    return (
      <GithubFormBody
        workspaceId={workspaceId}
        shouldAutoFocus={isExpanded}
        onConnected={() => setIsExpanded(false)}
      />
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3 text-label text-muted-foreground">
      <span className="min-w-0 flex-1 truncate">
        {isGlobalConnected ? 'Uses the all-workspaces connection' : 'No key for this workspace'}
      </span>
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="shrink-0 rounded-md px-1.5 py-0.5 text-secondary text-muted-foreground hover:bg-hover hover:text-foreground"
      >
        Use a different key
      </button>
    </div>
  );
};
