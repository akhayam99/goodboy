// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseIssueCode } from './parseIssueCode';
import { routeIssueCode, type LookupContext, type LookupProvider } from './routeIssueCode';

const context = (
  patch: Partial<LookupContext> & { readonly on?: ReadonlyArray<LookupProvider> },
) => ({
  connected: new Set<LookupProvider>(patch.on ?? []),
  jiraProjectKey: patch.jiraProjectKey ?? null,
  sentryProjects: patch.sentryProjects ?? [],
  githubRepos: patch.githubRepos ?? [],
  gitlabProjects: patch.gitlabProjects ?? [],
  linearTeamKeys: patch.linearTeamKeys ?? null,
});

const route = (input: string, ctx: LookupContext) => routeIssueCode(parseIssueCode(input), ctx);

describe('routeIssueCode', () => {
  it('sends a key that matches the Jira project to Jira alone', () => {
    expect(route('NW-142', context({ on: ['linear', 'jira'], jiraProjectKey: 'nw' }))).toEqual({
      kind: 'lookup',
      label: 'NW-142',
      targets: [{ provider: 'jira', key: 'NW-142' }],
    });
  });

  it('asks Linear and Jira together for an unknown prefix', () => {
    expect(route('CAS-231', context({ on: ['linear', 'jira'], jiraProjectKey: 'NW' }))).toEqual({
      kind: 'lookup',
      label: 'CAS-231',
      targets: [
        { provider: 'linear', identifier: 'CAS-231' },
        { provider: 'jira', key: 'CAS-231' },
      ],
    });
  });

  it('sends a key that matches a known Linear team to Linear alone', () => {
    expect(
      route(
        'CAS-231',
        context({ on: ['linear', 'jira'], jiraProjectKey: 'NW', linearTeamKeys: ['CAS'] }),
      ),
    ).toEqual({
      kind: 'lookup',
      label: 'CAS-231',
      targets: [{ provider: 'linear', identifier: 'CAS-231' }],
    });
  });

  it('still asks Linear and Jira together when the team keys are known but the prefix matches neither', () => {
    expect(
      route(
        'OPS-44',
        context({ on: ['linear', 'jira'], jiraProjectKey: 'NW', linearTeamKeys: ['CAS'] }),
      ),
    ).toEqual({
      kind: 'lookup',
      label: 'OPS-44',
      targets: [
        { provider: 'linear', identifier: 'OPS-44' },
        { provider: 'jira', key: 'OPS-44' },
      ],
    });
  });

  it('adds Sentry when the prefix is a connected Sentry project', () => {
    const routed = route(
      'NOTIFY-12',
      context({ on: ['linear', 'sentry'], sentryProjects: ['notify'] }),
    );
    expect(routed).toEqual({
      kind: 'lookup',
      label: 'NOTIFY-12',
      targets: [
        { provider: 'linear', identifier: 'NOTIFY-12' },
        { provider: 'sentry', shortId: 'NOTIFY-12' },
      ],
    });
  });

  it('says which trackers to connect when none can answer a key', () => {
    expect(route('CAS-231', context({ on: ['github'] }))).toEqual({
      kind: 'not-connected',
      label: 'CAS-231',
      providers: ['linear', 'jira'],
    });
  });

  it('asks Sentry for a short id, and treats it as text without Sentry', () => {
    expect(route('NOTIFY-3F', context({ on: ['sentry'] }))).toEqual({
      kind: 'lookup',
      label: 'NOTIFY-3F',
      targets: [{ provider: 'sentry', shortId: 'NOTIFY-3F' }],
    });
    expect(route('NOTIFY-3F', context({ on: ['linear'] }))).toEqual({ kind: 'none' });
  });

  it('asks every GitHub and GitLab repo of the workspace for #N', () => {
    expect(
      route(
        '#482',
        context({
          on: ['github', 'gitlab'],
          githubRepos: ['acme/storefront-web', 'acme/ledger-core'],
          gitlabProjects: ['payments/api'],
        }),
      ),
    ).toEqual({
      kind: 'lookup',
      label: '#482',
      targets: [
        { provider: 'github', repo: 'acme/storefront-web', number: 482 },
        { provider: 'github', repo: 'acme/ledger-core', number: 482 },
        { provider: 'gitlab', projectPath: 'payments/api', iid: 482 },
      ],
    });
    expect(route('#482', context({ on: ['linear'] }))).toEqual({ kind: 'no-repo', label: '#482' });
  });

  it('routes a link to its host only', () => {
    expect(
      route(
        'https://github.com/acme/storefront-web/issues/482',
        context({ on: ['github', 'linear'] }),
      ),
    ).toEqual({
      kind: 'lookup',
      label: 'acme/storefront-web#482',
      targets: [{ provider: 'github', repo: 'acme/storefront-web', number: 482 }],
    });
    expect(route('https://acme.sentry.io/issues/4812/', context({}))).toEqual({
      kind: 'not-connected',
      label: '4812',
      providers: ['sentry'],
    });
  });

  it('never calls for free text', () => {
    expect(route('webhook', context({ on: ['linear', 'jira', 'github'] }))).toEqual({
      kind: 'none',
    });
  });
});
