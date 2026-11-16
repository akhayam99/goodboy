// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ProviderConnectionState, ProviderId } from '@goodboy/types';
import { connectionGroups } from './connectionGroups';
import { connectionsSubtitle } from './connectionsSubtitle';

type ProviderParams = {
  readonly id: ProviderId;
  readonly connection: ProviderConnectionState;
};

const aProvider = ({ id, connection }: ProviderParams) => ({ id, connection });

const ALL_TOOLS_OFF = {
  github: false,
  gitlab: false,
  bitbucket: false,
  linear: false,
  jira: false,
  sentry: false,
  slack: false,
};

const PROVIDERS = [
  aProvider({ id: 'moonshot', connection: 'missing' }),
  aProvider({ id: 'codex', connection: 'connected' }),
  aProvider({ id: 'gemini', connection: 'missing' }),
  aProvider({ id: 'anthropic', connection: 'connected' }),
  aProvider({ id: 'copilot', connection: 'installed_disconnected' }),
];

describe('connectionGroups', () => {
  it('keeps the fixed provider order in the grid and in the Not set up row', () => {
    const { providers } = connectionGroups({ providers: PROVIDERS, connectedTools: null });

    expect(providers.tiles).toEqual(['anthropic', 'codex']);
    expect(providers.setup).toEqual(['gemini', 'copilot', 'moonshot']);
    expect(providers).toMatchObject({ readyCount: 2, total: 5 });
  });

  it('never moves a provider when its health changes, only when it is not set up', () => {
    const healthy = connectionGroups({ providers: PROVIDERS, connectedTools: null });
    const broken = connectionGroups({
      providers: PROVIDERS.map((provider): ProviderParams =>
        provider.id === 'anthropic' ? { ...provider, connection: 'error' } : provider,
      ),
      connectedTools: null,
    });

    expect(broken.providers.tiles).toEqual(healthy.providers.tiles);
  });

  it('keeps a signed out CLI in the grid', () => {
    const { providers } = connectionGroups({
      providers: [
        { id: 'anthropic', connection: 'installed_disconnected', standing: 'signed_out' },
      ],
      connectedTools: null,
    });

    expect(providers.tiles).toEqual(['anthropic']);
  });

  it('puts the connected tools in the grid and the rest in the Not set up row', () => {
    const { tools } = connectionGroups({
      providers: [],
      connectedTools: { ...ALL_TOOLS_OFF, github: true, linear: true, slack: true },
    });

    expect(tools?.tiles).toEqual(['github', 'linear', 'slack']);
    expect(tools?.setup).toEqual(['gitlab', 'bitbucket', 'jira', 'sentry']);
    expect(tools).toMatchObject({ readyCount: 3, total: 7 });
  });

  it('has no tool group without a workspace', () => {
    expect(connectionGroups({ providers: PROVIDERS, connectedTools: null }).tools).toBeNull();
  });
});

describe('connectionsSubtitle', () => {
  it('counts the ready providers and the integrations of the workspace', () => {
    const groups = connectionGroups({
      providers: PROVIDERS,
      connectedTools: { ...ALL_TOOLS_OFF, github: true },
    });

    expect(connectionsSubtitle({ groups, workspaceName: 'Harborline' })).toBe(
      '2 of 5 providers ready · 1 of 7 integrations in Harborline',
    );
  });

  it('counts only providers without a workspace', () => {
    const groups = connectionGroups({ providers: PROVIDERS, connectedTools: null });

    expect(connectionsSubtitle({ groups, workspaceName: null })).toBe('2 of 5 providers ready');
  });

  it('asks for a first provider when nothing is set up', () => {
    const groups = connectionGroups({
      providers: [aProvider({ id: 'anthropic', connection: 'missing' })],
      connectedTools: ALL_TOOLS_OFF,
    });

    expect(connectionsSubtitle({ groups, workspaceName: 'Harborline' })).toBe(
      'Connect a provider to start a session',
    );
  });
});
