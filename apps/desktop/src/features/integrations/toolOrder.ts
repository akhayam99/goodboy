import type { IntegrationGlyphProvider } from '../../shared/components/IntegrationGlyph';

export const TOOL_ORDER = [
  'github',
  'gitlab',
  'bitbucket',
  'linear',
  'jira',
  'sentry',
  'slack',
] as const satisfies ReadonlyArray<IntegrationGlyphProvider>;
