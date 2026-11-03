// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TEST_NOW } from '@goodboy/types/testing';
import { applyMountRequest, type MountRequestProjectionState } from './applyMountRequest';
import { bitbucketMountOf, bitbucketSessionOf, gitlabMountOf, gitlabSessionOf } from './requestOf';
import type { MountBitbucketPrState, MountGitlabMrState, MountRequestState } from './state';
import { gitlabMrFixture } from './testing/gitlabMrFixture';

const { session, ledger, ledgerMount, relayMount, makeMr, mountState, seedState } = gitlabMrFixture;

const GITLAB: MountGitlabMrState = mountState({
  mountId: ledgerMount,
  projectId: ledger.id,
  name: 'ledger-core',
  mr: makeMr({ iid: 7, name: 'ledger-core' }),
});

const BITBUCKET: MountBitbucketPrState = {
  kind: 'bitbucket',
  mountId: ledgerMount,
  projectId: ledger.id,
  revision: 1,
  host: 'bitbucket.org',
  repo: null,
  repository: 'harborline/ledger-core',
  branch: 'ak/ledger-core',
  prs: [],
  links: [],
  checks: null,
  reviewDecision: null,
  pr: null,
  selected: null,
  fetchedAt: TEST_NOW,
  failedAt: null,
  loading: false,
  error: null,
};

const REQUESTS: ReadonlyArray<{
  readonly host: 'gitlab' | 'bitbucket';
  request: MountRequestState;
}> = [
  { host: 'gitlab', request: GITLAB },
  { host: 'bitbucket', request: BITBUCKET },
];

const baseState = (): MountRequestProjectionState => ({
  ...seedState(),
  sessionProjectMounts: {},
  mountRequests: {},
  sessionRequests: {},
});

describe('applyMountRequest', () => {
  it.each(REQUESTS)(
    'stores the $host request under its mount and projects it onto the session',
    ({ host, request }) => {
      const next = applyMountRequest({
        state: baseState(),
        sessionId: session.id,
        mountId: ledgerMount,
        request,
      });

      expect(next.mountRequests[ledgerMount]).toBe(request);
      expect(next.sessionRequests[session.id]?.kind).toBe(host);
      expect(gitlabMountOf({ state: next, mountId: ledgerMount })).toBe(
        host === 'gitlab' ? request : undefined,
      );
      expect(bitbucketMountOf({ state: next, mountId: ledgerMount })).toBe(
        host === 'bitbucket' ? request : undefined,
      );
      expect(gitlabSessionOf({ state: next, sessionId: session.id })?.kind).toBe(
        host === 'gitlab' ? 'gitlab' : undefined,
      );
      expect(bitbucketSessionOf({ state: next, sessionId: session.id })?.kind).toBe(
        host === 'bitbucket' ? 'bitbucket' : undefined,
      );
    },
  );

  it.each(REQUESTS)('drops the $host request and its session projection on null', ({ request }) => {
    const filled = applyMountRequest({
      state: baseState(),
      sessionId: session.id,
      mountId: ledgerMount,
      request,
    });

    const next = applyMountRequest({
      state: { ...baseState(), ...filled },
      sessionId: session.id,
      mountId: ledgerMount,
      request: null,
    });

    expect(next.mountRequests[ledgerMount]).toBeUndefined();
    expect(next.sessionRequests[session.id]).toBeUndefined();
  });

  it.each(REQUESTS)(
    'keeps the session projection of the active mount when a sibling $host mount changes',
    ({ request }) => {
      const filled = applyMountRequest({
        state: baseState(),
        sessionId: session.id,
        mountId: ledgerMount,
        request,
      });

      const next = applyMountRequest({
        state: { ...baseState(), ...filled },
        sessionId: session.id,
        mountId: relayMount,
        request: { ...request, mountId: relayMount },
      });

      expect(next.mountRequests[relayMount]?.mountId).toBe(relayMount);
      expect(next.sessionRequests[session.id]).toEqual(filled.sessionRequests[session.id]);
    },
  );
});
