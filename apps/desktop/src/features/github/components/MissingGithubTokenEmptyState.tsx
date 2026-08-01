import type { WorkspaceId } from '@goodboy/types';
import { IntegrationConnectPanel } from '../../integrations/components/IntegrationConnectPanel';
import { GithubFormBody } from '../../integrations/github/GithubFormBody';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly compact?: boolean;
  readonly onConnected: () => void;
  readonly shouldAutoFocus?: boolean;
};

export const MissingGithubTokenEmptyState = ({
  workspaceId,
  compact = false,
  onConnected,
  shouldAutoFocus = false,
}: Props) => (
  <div className={compact ? 'flex justify-center py-5' : 'flex justify-center'}>
    <IntegrationConnectPanel
      provider="github"
      description="Connect a GitHub token to review pull requests and issues from this repository."
      size={compact ? 'sm' : 'lg'}
      headingLevel={compact ? undefined : 2}
    >
      <GithubFormBody
        workspaceId={workspaceId}
        onConnected={onConnected}
        shouldAutoFocus={shouldAutoFocus}
      />
    </IntegrationConnectPanel>
  </div>
);
