import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { WorkspaceIntegrationProvider } from '@goodboy/types';
import { QUERY_BRIDGE_VERBS, buildIntegrationsGuard } from './integrationsGuard';
import { buildWorkspaceScopeGuard } from './workspaceScopeGuard';

const SESSION_SCOPED_PROVIDERS: ReadonlyArray<string> = ['project'];

const catalogSource = (): string =>
  readFileSync(resolve(process.cwd(), 'src-tauri/src/query_bridge/protocol.rs'), 'utf8');

const catalogVerbs = (): Record<string, ReadonlyArray<string>> => {
  const entries = catalogSource().matchAll(
    /provider:\s*"([a-z]+)",\s*\n\s*verb:\s*"([a-z0-9-]+)"/g,
  );
  const out: Record<string, Array<string>> = {};
  for (const match of entries) {
    const provider = match[1] ?? '';
    const verb = match[2] ?? '';
    out[provider] = [...(out[provider] ?? []), verb];
  }
  return out;
};

describe('buildIntegrationsGuard', () => {
  it('says nothing when the workspace has no connection', () => {
    expect(buildIntegrationsGuard({ providers: [], isBridgeServing: true })).toBe('');
  });

  it('says nothing while the bridge is not serving, connections or not', () => {
    const guard = buildIntegrationsGuard({
      providers: ['linear', 'jira'],
      isBridgeServing: false,
    });

    expect(guard).toBe('');
    expect(guard).not.toContain('GOODBOY_BIN');
  });

  it('lists only the providers the workspace actually connected', () => {
    const guard = buildIntegrationsGuard({ providers: ['linear'], isBridgeServing: true });

    expect(guard).toContain('[integrations]');
    expect(guard).toContain('linear: issue,');
    expect(guard).not.toContain('jira:');
    expect(guard).not.toContain('slack:');
  });

  it('names the command an agent has to type', () => {
    const guard = buildIntegrationsGuard({ providers: ['linear'], isBridgeServing: true });

    expect(guard).toContain('"$GOODBOY_BIN" query linear issue ENG-123');
    expect(guard).toContain('"$GOODBOY_BIN" query <provider> --help');
  });

  it('quotes the binary so a path with a space still runs', () => {
    const guard = buildIntegrationsGuard({ providers: ['linear'], isBridgeServing: true });

    expect(guard).not.toMatch(/[^"]\$GOODBOY_BIN" query/);
    expect(guard).toContain('Keep the quotes');
  });

  it('never leaks a credential, a token or an MCP endpoint into the prompt', () => {
    const guard = buildIntegrationsGuard({
      providers: ['linear', 'sentry', 'gitlab', 'jira', 'bitbucket', 'slack'],
      isBridgeServing: true,
    });

    expect(guard).not.toMatch(/token|api[_ -]?key|secret|credential_id/i);
  });

  it('collapses a duplicated provider into a single line', () => {
    const guard = buildIntegrationsGuard({
      providers: ['linear', 'linear'],
      isBridgeServing: true,
    });

    expect(guard.split('\n').filter((line) => line.startsWith('linear:'))).toHaveLength(1);
  });

  it('stays short enough to ride along on every prompt', () => {
    const guard = buildIntegrationsGuard({
      providers: ['linear', 'sentry', 'gitlab', 'jira', 'bitbucket', 'slack'],
      isBridgeServing: true,
    });

    expect(guard.split('\n')).toHaveLength(12);
  });

  it('ignores a provider the bridge cannot serve', () => {
    const guard = buildIntegrationsGuard({
      providers: ['github' as WorkspaceIntegrationProvider, 'linear'],
      isBridgeServing: true,
    });

    expect(guard).not.toContain('github');
    expect(guard).toContain('linear:');
  });

  it('ignores a name that only exists on the object prototype', () => {
    const guard = buildIntegrationsGuard({
      providers: [
        'toString' as WorkspaceIntegrationProvider,
        'constructor' as WorkspaceIntegrationProvider,
        'linear',
      ],
      isBridgeServing: true,
    });

    expect(guard).not.toContain('toString');
    expect(guard).not.toContain('constructor');
    expect(guard.split('\n')).toHaveLength(7);
  });
});

describe('the advertised verbs', () => {
  it('match the catalog the Rust bridge dispatches', () => {
    const rust = catalogVerbs();
    const integrationProviders = Object.keys(rust).filter(
      (provider) => !SESSION_SCOPED_PROVIDERS.includes(provider),
    );

    expect(integrationProviders.sort()).toEqual(Object.keys(QUERY_BRIDGE_VERBS).sort());
    for (const [provider, verbs] of Object.entries(QUERY_BRIDGE_VERBS)) {
      expect([...verbs].sort()).toEqual([...(rust[provider] ?? [])].sort());
    }
  });

  it('advertise the session-scoped project verbs through the workspace scope guard instead', () => {
    const rust = catalogVerbs();

    expect(rust['project']).toEqual(['materialize']);
    const guard = buildWorkspaceScopeGuard({
      containerDir: '/tmp/container',
      projects: [],
      mounts: [],
      isBridgeServing: true,
    });
    expect(guard).toContain('query project materialize');
    const silent = buildWorkspaceScopeGuard({
      containerDir: '/tmp/container',
      projects: [],
      mounts: [],
      isBridgeServing: false,
    });
    expect(silent).not.toContain('GOODBOY_BIN');
  });
});
