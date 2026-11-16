import type { GhTokenStatus, IntegrationBinding } from '@goodboy/types';
import type { IntegrationGlyphProvider } from '../../shared/components/IntegrationGlyph';
import { isGithubConnected } from './github/isGithubConnected';

type Params = {
  readonly integrations: ReadonlyArray<IntegrationBinding>;
  readonly githubStatuses: ReadonlyArray<GhTokenStatus | null | undefined>;
};

type BoundParams = {
  readonly provider: IntegrationGlyphProvider;
};

export const connectedToolsOf = ({
  integrations,
  githubStatuses,
}: Params): Readonly<Record<IntegrationGlyphProvider, boolean>> => {
  const isBound = ({ provider }: BoundParams): boolean =>
    integrations.some((binding) => binding.provider === provider);
  return {
    github: isGithubConnected({ statuses: githubStatuses }),
    gitlab: isBound({ provider: 'gitlab' }),
    bitbucket: isBound({ provider: 'bitbucket' }),
    linear: isBound({ provider: 'linear' }),
    jira: isBound({ provider: 'jira' }),
    sentry: isBound({ provider: 'sentry' }),
    slack: isBound({ provider: 'slack' }),
  };
};
