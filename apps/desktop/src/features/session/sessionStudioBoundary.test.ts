import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SESSION_SURFACE_FILES = [
  './components/SessionWorkspace/parts/PrPane.tsx',
  './components/SessionOverviewPane/LinkedWorkSection.tsx',
  './components/SessionWorkspace/parts/IntegrationPane/index.tsx',
  '../integrations/ConnectIntegrationEmptyState.tsx',
  '../github/components/MissingGithubRemoteEmptyState.tsx',
  './components/SessionOverviewPane/SessionCostChip.tsx',
  '../chat/components/AuthRequiredCallout/index.tsx',
  './components/CreateAgentPopover/index.tsx',
  '../../shared/components/RoutingPicker/index.tsx',
] as const;

describe('session studio boundary', () => {
  it.each(SESSION_SURFACE_FILES)('%s does not dispatch a top-level studio event', (file) => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    expect(source).not.toMatch(/goodboy:open-[a-z-]+-studio/);
  });
});
