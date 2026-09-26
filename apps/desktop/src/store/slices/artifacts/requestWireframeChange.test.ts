import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId, WireframeArtifact } from '@goodboy/types';

const { artifacts } = vi.hoisted(() => ({
  artifacts: {
    list: vi.fn(async (_sessionId: string) => [] as ReadonlyArray<Record<string, unknown>>),
    annotate: vi.fn(async (_params: Record<string, unknown>) => true),
  },
}));

vi.mock('../../../features/artifacts/artifacts', () => ({
  listArtifactsForSession: (sessionId: string) => artifacts.list(sessionId),
  annotateArtifactRevision: (params: Record<string, unknown>) => artifacts.annotate(params),
}));

import { requestWireframeChange } from './requestWireframeChange';

const SESSION_ID = 'session-1' as SessionId;

const artifact = {
  id: 'wireframe-1',
  agentId: 'agent-1',
  title: 'Settlement review flow',
  revision: 3,
  sourceText: '{"version":2}',
} as unknown as WireframeArtifact;

type Store = Record<string, unknown> & {
  wireframeDrafts: Record<string, Record<string, unknown>>;
};

const makeStore = ({ sendTurn }: { readonly sendTurn: () => Promise<unknown> }) => {
  const store: Store = {
    wireframeDrafts: {},
    sessionArtifacts: {},
    transcripts: {
      'agent-1': [
        {
          kind: 'artifact_capture_failed',
          runId: 'r',
          code: 'invalid_payload',
          message:
            'the wireframe document does not match the contract: transitions[0].toScreenId: no screen with id "summary"',
          at: new Date(Date.now() + 1000).toISOString(),
        },
      ],
    },
    sendTurn: vi.fn(sendTurn),
  };
  const set = (update: unknown) => {
    const patch = typeof update === 'function' ? (update as (s: Store) => object)(store) : update;
    Object.assign(store, patch);
  };
  return { store, set, get: () => store };
};

const request = {
  sessionId: SESSION_ID,
  artifact,
  screenTitle: 'Review batch',
  ask: 'Show who owns each exception',
  scope: 'screen' as const,
  screenId: 'review-batch',
  picked: [{ nodeId: 'exception-list', label: 'Exception list' }],
};

beforeEach(() => {
  artifacts.list.mockReset();
  artifacts.annotate.mockClear();
});

describe('requestWireframeChange', () => {
  it('records the ask on the revision that lands and marks the draft ready', async () => {
    artifacts.list.mockResolvedValue([{ ...artifact, revision: 4 }]);
    const { store, set, get } = makeStore({ sendTurn: async () => ({}) });
    await requestWireframeChange(set as never, get as never)(request);
    expect(store.sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'agent-1',
        content: expect.stringContaining('exception-list'),
      }),
    );
    expect(artifacts.annotate).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: 4,
        note: expect.objectContaining({ ask: 'Show who owns each exception' }),
      }),
    );
    expect(store.wireframeDrafts['wireframe-1']).toMatchObject({ status: 'ready', toRevision: 4 });
  });

  it('keeps the old version and says why when the new spec is not kept', async () => {
    artifacts.list.mockResolvedValue([artifact]);
    const { store, set, get } = makeStore({ sendTurn: async () => ({}) });
    await requestWireframeChange(set as never, get as never)(request);
    expect(artifacts.annotate).not.toHaveBeenCalled();
    expect(store.wireframeDrafts['wireframe-1']).toMatchObject({
      status: 'failed',
      fromRevision: 3,
      ask: 'Show who owns each exception',
    });
    expect(String(store.wireframeDrafts['wireframe-1']?.['reason'])).toContain(
      'no screen with id "summary"',
    );
  });

  it('fails the draft when the request never reaches the agent', async () => {
    const { store, set, get } = makeStore({
      sendTurn: async () => {
        throw new Error('agent is busy');
      },
    });
    await requestWireframeChange(set as never, get as never)(request);
    expect(store.wireframeDrafts['wireframe-1']).toMatchObject({
      status: 'failed',
      reason: 'The request did not reach the agent.',
    });
  });
});
