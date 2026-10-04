import { useState, type ReactNode } from 'react';
import { Notice } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { GithubFormBody } from '../../../integrations/github/GithubFormBody';
import { FORM_BODIES } from '../../../integrations/formBodies';
import { integrationLabel } from '../../../integrations/components/IntegrationGlyph';
import { hostsInOrder, type CodeHost } from '../hostFromRemote';
import { IntegrationChoiceRow } from './IntegrationChoiceRow';
import { StepHeading } from './StepHeading';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly originHost: CodeHost | null;
  readonly projectName: string | null;
  readonly connected: Readonly<Record<CodeHost, boolean>>;
  readonly githubIdentity: string | null;
};

const hostLine = ({
  host,
  isConnected,
  githubIdentity,
}: {
  readonly host: CodeHost;
  readonly isConnected: boolean;
  readonly githubIdentity: string | null;
}): string => {
  if (host === 'github') {
    return isConnected && githubIdentity !== null
      ? `Signed in as ${githubIdentity}.`
      : 'The GitHub CLI or an API key.';
  }
  if (host === 'gitlab') {
    return 'gitlab.com or your own server, with a token.';
  }
  return 'Bitbucket Cloud, with an app password.';
};

const originNotice = ({
  host,
  projectName,
}: {
  readonly host: CodeHost;
  readonly projectName: string | null;
}): string => {
  const label = integrationLabel({ provider: host });
  const subject = projectName ?? 'Your project';
  return host === 'github'
    ? `${subject} pushes to GitHub, and GitHub is already signed in on this Mac.`
    : `${subject} pushes to ${label}, and ${label} is already connected.`;
};

export const CodeHostStep = ({
  workspaceId,
  originHost,
  projectName,
  connected,
  githubIdentity,
}: Props) => {
  const [expanded, setExpanded] = useState<CodeHost | null>(null);
  const toggle = ({ host, next }: { readonly host: CodeHost; readonly next: boolean }) =>
    setExpanded(next ? host : null);
  const GitlabBody = FORM_BODIES.gitlab;
  const BitbucketBody = FORM_BODIES.bitbucket;
  const bodies: Readonly<Record<CodeHost, ReactNode>> = {
    github: <GithubFormBody workspaceId={workspaceId} shouldAutoFocus />,
    gitlab: <GitlabBody workspaceId={workspaceId} shouldAutoFocus />,
    bitbucket: <BitbucketBody workspaceId={workspaceId} shouldAutoFocus />,
  };

  return (
    <div className="flex flex-col gap-5">
      <StepHeading
        title="Where does your code live?"
        line="Goodboy pushes branches and opens pull requests there."
      />
      {originHost !== null && connected[originHost] && (
        <Notice
          tone="success"
          placement="inline"
          role="status"
          title={originNotice({ host: originHost, projectName })}
        />
      )}
      <ul className="flex flex-col gap-2">
        {hostsInOrder(originHost).map((host) => (
          <IntegrationChoiceRow
            key={host}
            provider={host}
            line={hostLine({ host, isConnected: connected[host], githubIdentity })}
            isReady={connected[host]}
            isExpanded={expanded === host}
            onExpandedChange={(next) => toggle({ host, next })}
          >
            {bodies[host]}
          </IntegrationChoiceRow>
        ))}
      </ul>
    </div>
  );
};
