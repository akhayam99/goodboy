import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';

export type FooterIntegrationEntry = {
  readonly provider: IntegrationGlyphProvider;
  readonly connectedLabel: string;
  readonly connectLabel: string;
  readonly availableInSimpleWorkspace: boolean;
};

export type FooterCategory = {
  readonly id: 'code-host' | 'tracking' | 'conversation';
  readonly groupLabel: string;
  readonly addLabel: string;
  readonly exhaustedLabel: string;
  readonly members: ReadonlyArray<FooterIntegrationEntry>;
};

export const FOOTER_CATEGORIES = [
  {
    id: 'code-host',
    groupLabel: 'Code hosts',
    addLabel: 'Connect a code host',
    exhaustedLabel: 'Every code host is connected',
    members: [
      {
        provider: 'github',
        connectedLabel: 'Review and act on pull requests across this workspace',
        connectLabel: 'Connect GitHub',
        availableInSimpleWorkspace: false,
      },
      {
        provider: 'gitlab',
        connectedLabel: 'Review merge requests and launch a session from a GitLab issue',
        connectLabel: 'Connect GitLab',
        availableInSimpleWorkspace: false,
      },
      {
        provider: 'bitbucket',
        connectedLabel: 'Review pull requests across this workspace',
        connectLabel: 'Connect Bitbucket',
        availableInSimpleWorkspace: false,
      },
    ],
  },
  {
    id: 'tracking',
    groupLabel: 'Trackers',
    addLabel: 'Connect a tracker',
    exhaustedLabel: 'Every tracker is connected',
    members: [
      {
        provider: 'linear',
        connectedLabel: 'Launch a session from a Linear issue',
        connectLabel: 'Connect Linear',
        availableInSimpleWorkspace: true,
      },
      {
        provider: 'jira',
        connectedLabel: 'Launch a session from a Jira issue',
        connectLabel: 'Connect Jira',
        availableInSimpleWorkspace: true,
      },
      {
        provider: 'sentry',
        connectedLabel: 'Launch a session from a Sentry issue',
        connectLabel: 'Connect Sentry',
        availableInSimpleWorkspace: false,
      },
    ],
  },
  {
    id: 'conversation',
    groupLabel: 'Conversation tools',
    addLabel: 'Connect a conversation tool',
    exhaustedLabel: 'Every conversation tool is connected',
    members: [
      {
        provider: 'slack',
        connectedLabel: 'Launch a session from a Slack thread',
        connectLabel: 'Connect Slack',
        availableInSimpleWorkspace: true,
      },
    ],
  },
] satisfies ReadonlyArray<FooterCategory>;
