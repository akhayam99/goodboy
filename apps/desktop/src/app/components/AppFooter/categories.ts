import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';

export type FooterIntegrationEntry = {
  readonly provider: IntegrationGlyphProvider;
  readonly connectedLabel: string;
  readonly connectLabel: string;
  readonly availableInSimpleWorkspace: boolean;
};

export const FOOTER_INTEGRATIONS = [
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
  {
    provider: 'slack',
    connectedLabel: 'Launch a session from a Slack thread',
    connectLabel: 'Connect Slack',
    availableInSimpleWorkspace: true,
  },
] satisfies ReadonlyArray<FooterIntegrationEntry>;
