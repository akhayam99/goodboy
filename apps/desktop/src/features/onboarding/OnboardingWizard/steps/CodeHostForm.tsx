import type { WorkspaceId } from '@goodboy/types';
import { BitbucketFormBody } from '../../../integrations/bitbucket/BitbucketFormBody';
import { GithubFormBody } from '../../../integrations/github/GithubFormBody';
import { GitlabFormBody } from '../../../integrations/gitlab/GitlabFormBody';

export type CodeHost = 'github' | 'gitlab' | 'bitbucket';

type Props = {
  readonly host: CodeHost;
  readonly workspaceId: WorkspaceId;
  readonly onConnected: () => void;
};

export const CodeHostForm = ({ host, workspaceId, onConnected }: Props) => {
  switch (host) {
    case 'github':
      return <GithubFormBody workspaceId={workspaceId} onConnected={onConnected} />;
    case 'gitlab':
      return <GitlabFormBody workspaceId={workspaceId} onConnected={onConnected} />;
    case 'bitbucket':
      return <BitbucketFormBody workspaceId={workspaceId} onConnected={onConnected} />;
    default: {
      const exhaustive: never = host;
      return exhaustive;
    }
  }
};
