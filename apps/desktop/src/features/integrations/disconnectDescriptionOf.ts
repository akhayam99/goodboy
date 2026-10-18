import { integrationLabel, type IntegrationGlyphProvider } from './components/IntegrationGlyph';

type Params = {
  readonly provider: Exclude<IntegrationGlyphProvider, 'github'>;
};

export const disconnectDescriptionOf = ({ provider }: Params): string => {
  if (provider === 'slack') {
    return 'Disconnects this workspace from Slack. The saved credential remains available to other workspaces.';
  }
  return `Disconnects this workspace from the ${integrationLabel({ provider })} personal API key. The key stays saved for your other workspaces.`;
};
