import type { WorkspaceId } from '@goodboy/types';
import { IntegrationConnectPanel } from '../../integrations/components/IntegrationConnectPanel';
import { GithubFormBody } from '../../integrations/github/GithubFormBody';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly compact?: boolean;
};

export const MissingGithubRemoteEmptyState = ({ workspaceId, compact = false }: Props) => (
  <div className={compact ? 'flex justify-center py-5' : 'flex justify-center'}>
    <IntegrationConnectPanel
      provider="github"
      description="This workspace does not have a GitHub remote. Add one to review pull requests, or set a workspace token below."
    >
      <GithubFormBody workspaceId={workspaceId} />
    </IntegrationConnectPanel>
  </div>
);
