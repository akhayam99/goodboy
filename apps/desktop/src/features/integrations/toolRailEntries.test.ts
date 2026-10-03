import { describe, expect, it } from 'vitest';
import { FOOTER_INTEGRATIONS } from '../../app/components/AppFooter/categories';
import { TOOL_ORDER, toolRailEntries } from './toolRailEntries';

const NONE_CONNECTED = {
  github: false,
  gitlab: false,
  bitbucket: false,
  linear: false,
  jira: false,
  sentry: false,
  slack: false,
};

describe('toolRailEntries', () => {
  it('lists the tools in the order the footer and the Integrations rail use', () => {
    expect(TOOL_ORDER).toEqual(FOOTER_INTEGRATIONS.map(({ provider }) => provider));
  });

  it('names the signed in GitHub account and leaves the others not connected', () => {
    const entries = toolRailEntries({
      integrations: [],
      connected: { ...NONE_CONNECTED, github: true },
      githubIdentity: 'harborline-bot',
    });

    expect(entries.find((entry) => entry.tool === 'github')).toEqual({
      tool: 'github',
      label: 'GitHub',
      subtitle: 'harborline-bot',
      isConnected: true,
    });
    expect(entries.find((entry) => entry.tool === 'slack')?.subtitle).toBe('Not connected');
  });
});
