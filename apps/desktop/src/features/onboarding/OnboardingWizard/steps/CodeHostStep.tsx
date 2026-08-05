import { useState } from 'react';
import { FolderGit2, GitBranch } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { BitbucketIcon, GithubIcon, GitlabIcon } from '../../../../shared/components/brand-icons';
import { Segmented, type SegmentedOption } from '../Segmented';
import { CodeHostForm, type CodeHost } from './CodeHostForm';

type Props = {
  readonly workspaceId: WorkspaceId | null;
  readonly githubConnected: boolean;
  readonly gitlabConnected: boolean;
  readonly bitbucketConnected: boolean;
  readonly onConnected: () => void;
};

const initialHost = ({
  githubConnected,
  gitlabConnected,
  bitbucketConnected,
}: Pick<Props, 'githubConnected' | 'gitlabConnected' | 'bitbucketConnected'>): CodeHost => {
  if (githubConnected) {
    return 'github';
  }
  if (gitlabConnected) {
    return 'gitlab';
  }
  if (bitbucketConnected) {
    return 'bitbucket';
  }
  return 'github';
};

export const CodeHostStep = ({
  workspaceId,
  githubConnected,
  gitlabConnected,
  bitbucketConnected,
  onConnected,
}: Props) => {
  const [host, setHost] = useState<CodeHost>(
    initialHost({ githubConnected, gitlabConnected, bitbucketConnected }),
  );

  const options: ReadonlyArray<SegmentedOption<CodeHost>> = [
    {
      value: 'github',
      label: 'GitHub',
      icon: GithubIcon,
      color: 'var(--color-provider-github)',
      connected: githubConnected,
    },
    {
      value: 'gitlab',
      label: 'GitLab',
      icon: GitlabIcon,
      color: 'var(--color-provider-gitlab)',
      connected: gitlabConnected,
    },
    {
      value: 'bitbucket',
      label: 'Bitbucket',
      icon: BitbucketIcon,
      color: 'var(--color-provider-bitbucket)',
      connected: bitbucketConnected,
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
          Link GitHub, GitLab or Bitbucket so Goodboy can review and resolve pull requests for this
          workspace. You can only use one at a time.
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
          <Segmented ariaLabel="Code host" options={options} value={host} onChange={setHost} />
          <div className="rounded-lg border border-border-soft/40 bg-subtle/20 p-4">
            <CodeHostForm host={host} workspaceId={workspaceId} onConnected={onConnected} />
          </div>
        </div>
      )}
    </div>
  );
};
