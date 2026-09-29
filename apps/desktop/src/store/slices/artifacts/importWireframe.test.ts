// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionArtifact, SessionId } from '@goodboy/types';

const { artifacts } = vi.hoisted(() => ({
  artifacts: {
    create: vi.fn(async (args: Record<string, unknown>) => ({ id: 'wireframe-9', ...args })),
    update: vi.fn(async (_args: Record<string, unknown>) => undefined),
    list: vi.fn(async (_sessionId: string) => []),
  },
}));

vi.mock('../../../features/artifacts/artifacts', () => ({
  createArtifact: (args: Record<string, unknown>) => artifacts.create(args),
  updateArtifactSource: (args: Record<string, unknown>) => artifacts.update(args),
  listArtifactsForSession: (sessionId: string) => artifacts.list(sessionId),
}));

import { importWireframe, replaceWireframeSpec } from './importWireframe';

const SESSION_ID = 'session-1' as SessionId;

const makeStore = () => {
  const store: Record<string, unknown> = {
    sessionArtifacts: {},
    spawnAgent: vi.fn(async () => 'agent-import'),
  };
  const set = (update: unknown) => {
    const patch =
      typeof update === 'function' ? (update as (s: typeof store) => object)(store) : update;
    Object.assign(store, patch);
  };
  return { store, set, get: () => store };
};

beforeEach(() => {
  artifacts.create.mockClear();
  artifacts.update.mockClear();
});

describe('importWireframe', () => {
  it('gives the imported spec an idle wireframe agent and marks the revision as an import', async () => {
    const { store, set, get } = makeStore();
    await importWireframe(
      set as never,
      get as never,
    )({
      sessionId: SESSION_ID,
      title: 'Cascadia onboarding',
      sourceText: '{"version":2}',
      fidelity: 'low',
    });
    expect(store['spawnAgent']).toHaveBeenCalledWith(SESSION_ID, {
      name: 'Wireframe',
      kindOverride: 'wireframe',
      focus: 'none',
    });
    expect(artifacts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'agent-import',
        kind: 'wireframe',
        sourceFormat: 'json',
        metadata: { fidelity: 'low', designProfile: {} },
        note: { author: 'import' },
      }),
    );
  });

  it('replaces a spec as a new version marked Imported JSON', async () => {
    const { set } = makeStore();
    await replaceWireframeSpec(set as never)({
      sessionId: SESSION_ID,
      artifact: {
        id: 'wireframe-1',
        title: 'Flow',
        sourceFormat: 'json',
        metadata: { fidelity: 'low', designProfile: {} },
      } as unknown as SessionArtifact,
      sourceText: '{"version":2}',
    });
    expect(artifacts.update).toHaveBeenCalledWith(
      expect.objectContaining({ artifactId: 'wireframe-1', note: { author: 'import' } }),
    );
  });
});
