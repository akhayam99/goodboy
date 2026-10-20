// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { branchFactsOf } from './branchFactsOf';
import { aMountRow, aRequest } from './testing/aMountRow';

const NOW = Date.UTC(2026, 9, 18, 10, 30, 0);
const MINUTE_MS = 60_000;

type AgoParams = {
  readonly minutesAgo: number;
};

const iso = ({ minutesAgo }: AgoParams): string =>
  new Date(NOW - minutesAgo * MINUTE_MS).toISOString();

const api = aMountRow({
  key: 'api',
  projectName: 'payments-api',
  branch: 'ak/eng-1190-tenant-limits',
  request: aRequest({
    provider: 'github',
    number: 309,
    isDraft: true,
    state: 'draft',
    checks: 'failure',
  }),
});

const ledger = aMountRow({
  key: 'ledger',
  projectName: 'ledger-core',
  branch: 'ak/eng-1190-ledger-limits',
  request: aRequest({ provider: 'gitlab', number: 42, checks: 'success' }),
});

describe('branchFactsOf', () => {
  it('says the host noun: # for GitHub and ! for GitLab', () => {
    const facts = branchFactsOf({
      rows: [api, ledger],
      fetchedAtByMountId: new Map([
        [api.mountId, iso({ minutesAgo: 1 })],
        [ledger.mountId, iso({ minutesAgo: 1 })],
      ]),
      behindByMountId: new Map(),
      liveCountByMountId: new Map(),
      now: NOW,
    });

    expect(facts.map((fact) => `${fact.request?.noun}${fact.request?.number}`)).toEqual([
      '#309',
      '!42',
    ]);
    expect(facts.map((fact) => fact.request?.checksWord)).toEqual([
      'checks failing',
      'checks passing',
    ]);
  });

  it('drops the checks word of a stale read and says when it was checked', () => {
    const [fact] = branchFactsOf({
      rows: [api],
      fetchedAtByMountId: new Map([[api.mountId, iso({ minutesAgo: 12 })]]),
      behindByMountId: new Map(),
      liveCountByMountId: new Map(),
      now: NOW,
    });

    expect(fact?.isStale).toBe(true);
    expect(fact?.request?.checksWord).toBeNull();
    expect(fact?.request?.number).toBe(309);
    expect(fact?.checkedAgo).toBe('12m ago');
  });

  it('keeps a fresh read whole', () => {
    const [fact] = branchFactsOf({
      rows: [api],
      fetchedAtByMountId: new Map([[api.mountId, iso({ minutesAgo: 2 })]]),
      behindByMountId: new Map(),
      liveCountByMountId: new Map(),
      now: NOW,
    });

    expect(fact?.isStale).toBe(false);
    expect(fact?.checkedAgo).toBeNull();
  });

  it('reads behind and live counts by mount', () => {
    const facts = branchFactsOf({
      rows: [api, ledger],
      fetchedAtByMountId: new Map(),
      behindByMountId: new Map([[api.mountId, 6]]),
      liveCountByMountId: new Map([[ledger.mountId, 2]]),
      now: NOW,
    });

    expect(facts.map((fact) => fact.behind)).toEqual([6, null]);
    expect(facts.map((fact) => fact.liveCount)).toEqual([0, 2]);
  });

  it('has no request for a branch without a pull request', () => {
    const bare = aMountRow({ key: 'bare', projectName: 'notify-relay', branch: 'ak/notify' });
    const [fact] = branchFactsOf({
      rows: [bare],
      fetchedAtByMountId: new Map(),
      behindByMountId: new Map(),
      liveCountByMountId: new Map(),
      now: NOW,
    });

    expect(fact?.request).toBeNull();
    expect(fact?.isStale).toBe(false);
  });
});
