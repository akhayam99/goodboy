import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';

export type FooterIntegrationEntry = {
  readonly provider: IntegrationGlyphProvider;
  readonly connectedLabel: string;
  readonly connectLabel: string;
};

export const FOOTER_INTEGRATIONS = [
  {
    provider: 'github',
    connectedLabel: 'Review and act on pull requests across this workspace',
    connectLabel: 'Connect GitHub',
  },
  {
    provider: 'gitlab',
    connectedLabel: 'Review merge requests and launch a session from a GitLab issue',
    connectLabel: 'Connect GitLab',
  },
  {
    provider: 'bitbucket',
    connectedLabel: 'Review pull requests across this workspace',
    connectLabel: 'Connect Bitbucket',
  },
  {
    provider: 'linear',
    connectedLabel: 'Launch a session from a Linear issue',
    connectLabel: 'Connect Linear',
  },
  {
    provider: 'jira',
    connectedLabel: 'Launch a session from a Jira issue',
    connectLabel: 'Connect Jira',
  },
  {
    provider: 'sentry',
    connectedLabel: 'Launch a session from a Sentry issue',
    connectLabel: 'Connect Sentry',
  },
  {
    provider: 'slack',
    connectedLabel: 'Launch a session from a Slack thread',
    connectLabel: 'Connect Slack',
  },
] satisfies ReadonlyArray<FooterIntegrationEntry>;
