import { describe, expect, it } from 'vitest';
import type { IntegrationBinding } from '@goodboy/types';
import {
  bindingIdOf,
  credentialIdOf,
  isoDateTimeOf,
  workspaceIdOf,
} from '../../__tests__/helpers/brandedIds';
import { TOOL_CATALOG } from './toolCatalog';
import { QUIET_TOOL_HEALTH } from '../../__tests__/helpers/quietToolHealth';
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

const LINEAR: IntegrationBinding = {
  id: bindingIdOf({ value: 'binding-linear' }),
  workspaceId: workspaceIdOf({ value: 'workspace-1' }),
  projectId: null,
  credentialId: credentialIdOf({ value: 'credential-linear' }),
  createdAt: isoDateTimeOf({ value: '2026-09-01' }),
  updatedAt: isoDateTimeOf({ value: '2026-09-01' }),
  provider: 'linear',
  config: { viewerName: 'Mara Quint', viewerUserId: 'mara', workspaceUrlKey: 'harborline' },
};

describe('toolRailEntries', () => {
  it('lists the tools in the order the footer and the Integrations rail use', () => {
    expect(TOOL_ORDER).toEqual(TOOL_CATALOG.map(({ provider }) => provider));
  });

  it('names the signed in GitHub account and leaves the others not connected', () => {
    const entries = toolRailEntries({
      integrations: [],
      connected: { ...NONE_CONNECTED, github: true },
      githubIdentity: 'harborline-bot',
      secrets: {},
    });

    expect(entries.find((entry) => entry.tool === 'github')).toEqual({
      tool: 'github',
      label: 'GitHub',
      subtitle: 'harborline-bot',
      isConnected: true,
      health: QUIET_TOOL_HEALTH,
    });
    expect(entries.find((entry) => entry.tool === 'slack')?.subtitle).toBe('Not connected');
  });

  it('marks a connected tool whose key is missing as danger with its reason', () => {
    const entries = toolRailEntries({
      integrations: [LINEAR],
      connected: { ...NONE_CONNECTED, linear: true },
      githubIdentity: null,
      secrets: { [LINEAR.id]: 'missing' },
    });

    expect(entries.find((entry) => entry.tool === 'linear')?.health).toEqual({
      signal: 'danger',
      chip: 'Key missing',
      reason: 'Key missing on this Mac',
    });
  });

  it('drops a result that belongs to a binding that was replaced', () => {
    const entries = toolRailEntries({
      integrations: [{ ...LINEAR, id: bindingIdOf({ value: 'binding-linear-2' }) }],
      connected: { ...NONE_CONNECTED, linear: true },
      githubIdentity: null,
      secrets: { [LINEAR.id]: 'missing' },
    });

    expect(entries.find((entry) => entry.tool === 'linear')?.health.signal).toBe('none');
  });

  it('keeps every other tool quiet so the rail shows no dot for a healthy account', () => {
    const entries = toolRailEntries({
      integrations: [LINEAR],
      connected: { ...NONE_CONNECTED, linear: true },
      githubIdentity: null,
      secrets: { [LINEAR.id]: 'present' },
    });

    expect(entries.filter((entry) => entry.health.signal !== 'none')).toEqual([]);
  });
});
