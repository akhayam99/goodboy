import { describe, expect, it } from 'vitest';
import type {
  AgentId,
  IsoDateTime,
  MountId,
  SearchHit,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { searchHitTarget } from './searchHitTarget';

const SESSION = 's-payout' as SessionId;
const WORKSPACE = 'ws-harborline' as WorkspaceId;

type HitParams = Partial<SearchHit>;

const hit = ({ ...overrides }: HitParams): SearchHit => ({
  docId: 'message:m1',
  kind: 'message',
  refId: 'm1',
  workspaceId: WORKSPACE,
  sessionId: SESSION,
  sessionTitle: 'Speed up the payout export',
  agentId: 'a-builder' as AgentId,
  agentName: 'Payout builder',
  mountId: null,
  provider: null,
  container: null,
  status: null,
  ordinal: null,
  url: null,
  isArchived: false,
  occurredAt: '2026-09-20T10:00:00.000Z' as IsoDateTime,
  title: [{ text: 'HAR-231 Payout export times out', isMatch: false }],
  snippet: [],
  ...overrides,
});

describe('search hit target', () => {
  it('lands a message in its agent transcript and an agent on the agent', () => {
    expect(searchHitTarget({ hit: hit({}) })).toMatchObject({
      kind: 'transcript',
      sessionId: SESSION,
      agentId: 'a-builder',
      label: 'Open in transcript',
    });
    expect(searchHitTarget({ hit: hit({ kind: 'agent', docId: 'agent:a' }) })).toMatchObject({
      kind: 'transcript',
      label: 'Open agent',
    });
  });

  it('lands a session on the session and every artifact kind on its viewer', () => {
    expect(searchHitTarget({ hit: hit({ kind: 'session' }) })).toMatchObject({
      kind: 'session',
    });
    for (const kind of ['plan', 'report', 'wireframe'] as const) {
      expect(searchHitTarget({ hit: hit({ kind, refId: 'art-1' }) })).toMatchObject({
        kind: 'artifact',
        artifactId: 'art-1',
        label: `Open ${kind}`,
      });
    }
  });

  it('lands a decision on its number in Context and a question in Questions', () => {
    expect(searchHitTarget({ hit: hit({ kind: 'decision', ordinal: 3 }) })).toMatchObject({
      kind: 'decision',
      number: 3,
    });
    expect(searchHitTarget({ hit: hit({ kind: 'decision', ordinal: null }) })).toMatchObject({
      kind: 'blocked',
    });
    expect(searchHitTarget({ hit: hit({ kind: 'question', refId: 'q-1' }) })).toMatchObject({
      kind: 'question',
      questionId: 'q-1',
    });
  });

  it('opens a linked issue in its lens and a starred one in the Inbox', () => {
    expect(
      searchHitTarget({
        hit: hit({
          kind: 'issue',
          docId: 'task:s-payout:linear:lin-231',
          refId: 'lin-231',
          provider: 'linear',
          container: 'HAR-231',
          url: 'https://linear.app/harborline/issue/HAR-231',
        }),
      }),
    ).toMatchObject({
      kind: 'linked-issue',
      task: { provider: 'linear', externalId: 'lin-231', identifier: 'HAR-231' },
      label: 'Open the Linear issue',
    });
    expect(
      searchHitTarget({
        hit: hit({
          kind: 'issue',
          docId: 'starred:ws-harborline:sentry:77',
          refId: '77',
          provider: 'sentry',
          sessionId: null,
        }),
      }),
    ).toEqual({
      kind: 'inbox',
      workspaceId: WORKSPACE,
      provider: 'sentry',
      recordKey: 'sentry:error:77',
      label: 'Open in Inbox',
    });
  });

  it('opens a pull request in Review, or on its provider when no session has it', () => {
    expect(searchHitTarget({ hit: hit({ kind: 'pr' }) })).toMatchObject({ kind: 'review' });
    expect(
      searchHitTarget({
        hit: hit({ kind: 'pr', sessionId: null, provider: 'github', url: 'https://x.test/1' }),
      }),
    ).toEqual({ kind: 'url', url: 'https://x.test/1', label: 'Open in GitHub' });
    expect(searchHitTarget({ hit: hit({ kind: 'pr', sessionId: null }) })).toMatchObject({
      kind: 'blocked',
    });
  });

  it('opens a mounted branch in Diff and refuses a detached one', () => {
    expect(
      searchHitTarget({
        hit: hit({ kind: 'branch', mountId: 'm1' as MountId, status: 'attached' }),
      }),
    ).toMatchObject({ kind: 'diff', mountId: 'm1' });
    expect(
      searchHitTarget({
        hit: hit({ kind: 'branch', mountId: 'm1' as MountId, status: 'detached' }),
      }),
    ).toMatchObject({ kind: 'blocked', label: 'Open in Diff' });
  });

  it('never offers to open inside an archived session', () => {
    for (const kind of ['session', 'message', 'plan', 'decision', 'pr'] as const) {
      expect(searchHitTarget({ hit: hit({ kind, isArchived: true, ordinal: 1 }) })).toMatchObject({
        kind: 'blocked',
        reason: expect.stringContaining('archived'),
      });
    }
  });
});
