import { useState } from 'react';
import { FolderGit2, GitBranch, GitFork } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { GithubFormBody } from '../../../integrations/github/GithubFormBody';
import { GitlabFormBody } from '../../../integrations/gitlab/GitlabFormBody';
import { Segmented, type SegmentedOption } from '../Segmented';

type Host = 'github' | 'gitlab';

type Props = {
  readonly workspaceId: WorkspaceId | null;
  readonly githubConnected: boolean;
  readonly gitlabConnected: boolean;
  readonly onConnected: () => void;
};

export const CodeHostStep = ({
  workspaceId,
  githubConnected,
  gitlabConnected,
  onConnected,
}: Props) => {
  const [host, setHost] = useState<Host>(gitlabConnected && !githubConnected ? 'gitlab' : 'github');

  const options: ReadonlyArray<SegmentedOption<Host>> = [
    { value: 'github', label: 'GitHub', icon: GitBranch, connected: githubConnected },
    {
      value: 'gitlab',
      label: 'GitLab',
      icon: GitFork,
      color: 'var(--color-provider-gitlab)',
      connected: gitlabConnected,
    },
  ];

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 text-foreground">
        <GitBranch size={26} aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Connect a code host
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Link GitHub or GitLab so Goodboy can review and resolve pull requests for this workspace.
          You can only use one at a time.
        </p>
      </div>

      {workspaceId === null ? (
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-lg border border-border-soft/40 bg-subtle/20 px-4 py-6 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 text-muted-foreground">
            <FolderGit2 size={18} aria-hidden />
          </span>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Add a workspace first to connect a code host.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('goodboy:add-workspace'))}
          >
            <FolderGit2 size={14} aria-hidden /> Add workspace
          </Button>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-4 text-left">
          <Segmented ariaLabel="code host" options={options} value={host} onChange={setHost} />
          <div className="rounded-lg border border-border-soft/40 bg-subtle/20 p-4">
            {host === 'github' ? (
              <GithubFormBody workspaceId={workspaceId} onConnected={onConnected} />
            ) : (
              <GitlabFormBody workspaceId={workspaceId} onConnected={onConnected} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
