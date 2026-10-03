import type { IntegrationBinding } from '@goodboy/types';
import { integrationLabel, type IntegrationGlyphProvider } from './components/IntegrationGlyph';
import { toolIdentity } from './components/ToolSettingsScope/toolIdentity';

export const TOOL_ORDER = [
  'github',
  'gitlab',
  'bitbucket',
  'linear',
  'jira',
  'sentry',
  'slack',
] as const satisfies ReadonlyArray<IntegrationGlyphProvider>;

export type ToolRailEntry = {
  readonly tool: IntegrationGlyphProvider;
  readonly label: string;
  readonly subtitle: string;
  readonly isConnected: boolean;
};

type EntriesParams = {
  readonly integrations: ReadonlyArray<IntegrationBinding>;
  readonly connected: Readonly<Record<IntegrationGlyphProvider, boolean>>;
  readonly githubIdentity: string | null;
};

type SubtitleParams = EntriesParams & {
  readonly provider: IntegrationGlyphProvider;
};

export const toolRailSubtitle = ({
  provider,
  integrations,
  connected,
  githubIdentity,
}: SubtitleParams): string => {
  if (!connected[provider]) {
    return 'Not connected';
  }
  if (provider === 'github') {
    return githubIdentity ?? 'Connected';
  }
  return toolIdentity({
    binding: integrations.find((binding) => binding.provider === provider),
  });
};

export const toolRailEntries = (params: EntriesParams): ReadonlyArray<ToolRailEntry> =>
  TOOL_ORDER.map((tool) => ({
    tool,
    label: integrationLabel({ provider: tool }),
    subtitle: toolRailSubtitle({ ...params, provider: tool }),
    isConnected: params.connected[tool],
  }));
