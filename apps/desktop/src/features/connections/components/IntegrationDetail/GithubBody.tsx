import type { WorkspaceId } from '@goodboy/types';
import { GithubAccountRows } from '../../../integrations/github/GithubAccountRows';
import type { GithubConnection } from '../../../integrations/github/useGithubConnection';
import { ToolUsesSection } from '../ToolUsesSection';
import { ToolSection } from './ToolSection';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly isConnected: boolean;
  readonly connection: GithubConnection;
};

export const GithubBody = ({ workspaceId, workspaceName, isConnected, connection }: Props) => (
  <>
    {isConnected ? (
      <ToolUsesSection
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        tool="github"
        label="GitHub"
        isPaused={false}
        onOpenChannels={() => undefined}
      />
    ) : null}
    <ToolSection label="Account">
      <GithubAccountRows
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        connection={connection}
      />
    </ToolSection>
  </>
);
