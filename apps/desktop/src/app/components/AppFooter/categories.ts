import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';

export type FooterCategoryId = 'code-host' | 'tracking' | 'conversation';

export type FooterIntegrationEntry = {
  readonly provider: IntegrationGlyphProvider;
  readonly connectedLabel: string;
  readonly connectLabel: string;
  readonly availableInSimpleWorkspace: boolean;
};

export type FooterCategory = {
  readonly id: FooterCategoryId;
  readonly groupLabel: string;
  readonly emptyLabel: string;
  readonly addLabel: string;
  readonly exhaustedLabel: string;
  readonly members: ReadonlyArray<FooterIntegrationEntry>;
};

type FooterIntegrationDetail = {
  readonly category: FooterCategoryId;
  readonly connectedLabel: string;
  readonly connectLabel: string;
  readonly availableInSimpleWorkspace: boolean;
};

const FOOTER_INTEGRATIONS = {
  github: {
    category: 'code-host',
    connectedLabel: 'Review and act on pull requests across this workspace',
    connectLabel: 'Connect GitHub',
    availableInSimpleWorkspace: false,
  },
  gitlab: {
    category: 'code-host',
    connectedLabel: 'Review merge requests and launch a session from a GitLab issue',
    connectLabel: 'Connect GitLab',
    availableInSimpleWorkspace: false,
  },
  bitbucket: {
    category: 'code-host',
    connectedLabel: 'Review pull requests across this workspace',
    connectLabel: 'Connect Bitbucket',
    availableInSimpleWorkspace: false,
  },
  linear: {
    category: 'tracking',
    connectedLabel: 'Launch a session from a Linear issue',
    connectLabel: 'Connect Linear',
    availableInSimpleWorkspace: true,
  },
  jira: {
    category: 'tracking',
    connectedLabel: 'Launch a session from a Jira issue',
    connectLabel: 'Connect Jira',
    availableInSimpleWorkspace: true,
  },
  sentry: {
    category: 'tracking',
    connectedLabel: 'Launch a session from a Sentry issue',
    connectLabel: 'Connect Sentry',
    availableInSimpleWorkspace: false,
  },
  slack: {
    category: 'conversation',
    connectedLabel: 'Launch a session from a Slack thread',
    connectLabel: 'Connect Slack',
    availableInSimpleWorkspace: true,
  },
} satisfies Record<IntegrationGlyphProvider, FooterIntegrationDetail>;

const isFooterIntegrationProvider = (value: string): value is IntegrationGlyphProvider =>
  value in FOOTER_INTEGRATIONS;

export const FOOTER_INTEGRATION_PROVIDERS: ReadonlyArray<IntegrationGlyphProvider> = Object.keys(
  FOOTER_INTEGRATIONS,
).filter(isFooterIntegrationProvider);

const membersOf = ({
  categoryId,
}: {
  readonly categoryId: FooterCategoryId;
}): ReadonlyArray<FooterIntegrationEntry> =>
  FOOTER_INTEGRATION_PROVIDERS.filter(
    (provider) => FOOTER_INTEGRATIONS[provider].category === categoryId,
  ).map((provider) => ({
    provider,
    connectedLabel: FOOTER_INTEGRATIONS[provider].connectedLabel,
    connectLabel: FOOTER_INTEGRATIONS[provider].connectLabel,
    availableInSimpleWorkspace: FOOTER_INTEGRATIONS[provider].availableInSimpleWorkspace,
  }));

export const FOOTER_CATEGORIES = [
  {
    id: 'code-host',
    groupLabel: 'Code hosts',
    emptyLabel: 'Code host',
    addLabel: 'Connect a code host',
    exhaustedLabel: 'Every code host is connected',
    members: membersOf({ categoryId: 'code-host' }),
  },
  {
    id: 'tracking',
    groupLabel: 'Trackers',
    emptyLabel: 'Tracker',
    addLabel: 'Connect a tracker',
    exhaustedLabel: 'Every tracker is connected',
    members: membersOf({ categoryId: 'tracking' }),
  },
  {
    id: 'conversation',
    groupLabel: 'Conversation tools',
    emptyLabel: 'Conversation tool',
    addLabel: 'Connect a conversation tool',
    exhaustedLabel: 'Every conversation tool is connected',
    members: membersOf({ categoryId: 'conversation' }),
  },
] satisfies ReadonlyArray<FooterCategory>;
