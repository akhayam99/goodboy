const INTEGRATION_LABEL = {
  bitbucket: 'Bitbucket',
  github: 'GitHub',
  gitlab: 'GitLab',
  jira: 'Jira',
  linear: 'Linear',
  sentry: 'Sentry',
  slack: 'Slack',
} as const;

type Params = {
  readonly provider: keyof typeof INTEGRATION_LABEL;
};

export const integrationLabel = ({ provider }: Params): string => INTEGRATION_LABEL[provider];
