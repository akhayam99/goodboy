import { Eyebrow } from '@goodboy/ui';
import type { Session, SessionExternalTaskProvider } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useGithubConnection } from '../../../integrations/github/useGithubConnection';
import { LinkTicketPopover } from '../SessionWorkspace/parts/IntegrationPane/LinkTicketPopover';

type Tracker = {
  readonly provider: Exclude<SessionExternalTaskProvider, 'sentry' | 'bitbucket' | 'slack'>;
  readonly label: string;
};

const INTEGRATION_TRACKERS: ReadonlyArray<Tracker> = [
  { provider: 'linear', label: 'Linear' },
  { provider: 'jira', label: 'Jira' },
  { provider: 'gitlab', label: 'GitLab' },
];

type Props = {
  readonly session: Session;
};

export const OverviewLinkedWork = ({ session }: Props) => {
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[session.id] ?? EMPTY_ARRAY);
  const linkedIssues = useAppStore((s) => s.sessionGithub[session.id]?.linkedIssues ?? EMPTY_ARRAY);
  const integrations = useAppStore(
    (s) => s.workspaceIntegrations[session.workspaceId] ?? EMPTY_ARRAY,
  );
  const github = useGithubConnection({ workspaceId: session.workspaceId });

  if (externalTasks.length > 0 || linkedIssues.length > 0) {
    return null;
  }

  const connected: ReadonlyArray<Tracker> = [
    ...INTEGRATION_TRACKERS.filter(({ provider }) =>
      integrations.some((integration) => integration.provider === provider),
    ),
    ...(github.isAuthenticated ? [{ provider: 'github', label: 'GitHub' } as const] : []),
  ];

  return (
    <section aria-label="Linked work" className="flex flex-col gap-2">
      <Eyebrow label="Linked work" />
      {connected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {connected.map(({ provider, label }) => (
            <LinkTicketPopover
              key={provider}
              sessionId={session.id}
              workspaceId={session.workspaceId}
              provider={provider}
              providerLabel={label}
              noun={connected.length > 1 ? `${label} issue` : 'issue'}
              nounPhrase="an issue"
              nounPlural="issues"
            />
          ))}
        </div>
      ) : (
        <p className="px-0.5 text-xs text-muted-foreground">
          No tracker connected yet. Connect Linear, Jira, GitLab or GitHub from the integrations
          studios in the footer, then link issues here.
        </p>
      )}
    </section>
  );
};
