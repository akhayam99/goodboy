import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, ProviderRunId, SessionId } from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('../shared/lib/db', () => ({
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
  runDbMigrations: vi.fn(),
}));

const { upsertPlan, listPlansForSession, createArtifact, listArtifactsForSession } = vi.hoisted(
  () => ({
    upsertPlan: vi.fn(async () => undefined),
    listPlansForSession: vi.fn(async () => [] as ReadonlyArray<unknown>),
    createArtifact: vi.fn(async (args: { readonly sourceTurnId: string }) => ({
      id: 'artifact-1',
      sourceTurnId: args.sourceTurnId,
    })),
    listArtifactsForSession: vi.fn(async () => [] as ReadonlyArray<unknown>),
  }),
);

const { loadArtifactProvenance, appendArtifactProvenanceOmission } = vi.hoisted(() => ({
  loadArtifactProvenance: vi.fn(async () => null as { designProfileSummary: string | null } | null),
  appendArtifactProvenanceOmission: vi.fn(async () => undefined),
}));

vi.mock('../features/artifacts/artifactProvenance', () => ({
  loadArtifactProvenance,
  appendArtifactProvenanceOmission,
}));

vi.mock('../features/plans/plans', () => ({ upsertPlan, listPlansForSession }));
vi.mock('../features/artifacts/artifacts', () => ({ createArtifact, listArtifactsForSession }));

import { captureArtifactsFromTurn } from './turn-helpers';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;

const WIREFRAME_DOCUMENT = {
  version: 1,
  initialScreenId: 'home',
  theme: { name: 'generic' },
  screens: [
    {
      id: 'home',
      title: 'Home',
      viewport: 'desktop',
      root: { id: 'home-root', kind: 'text', text: 'Sessions' },
    },
  ],
};

type StatePatch = Readonly<Record<string, unknown>>;

const harness = () => {
  const patches: StatePatch[] = [];
  const set = ((updater: (state: StatePatch) => StatePatch) => {
    patches.push(updater({ sessionPlans: {}, sessionArtifacts: {} }));
  }) as never;
  return { patches, set };
};

const run = async (assistantText: string, agentName: string | null = null) => {
  const { patches, set } = harness();
  const result = await captureArtifactsFromTurn({
    set,
    sessionId: SESSION_ID,
    agentId: AGENT_ID,
    agentName,
    assistantText,
    emittingProvider: null,
    sourceTurnId: RUN_ID,
  });
  return { patches, result };
};

beforeEach(() => {
  upsertPlan.mockClear();
  listPlansForSession.mockClear();
  createArtifact.mockReset();
  createArtifact.mockImplementation(async (args: { readonly sourceTurnId: string }) => ({
    id: 'artifact-1',
    sourceTurnId: args.sourceTurnId,
  }));
  listArtifactsForSession.mockClear();
  listPlansForSession.mockResolvedValue([]);
  listArtifactsForSession.mockResolvedValue([]);
  loadArtifactProvenance.mockReset();
  loadArtifactProvenance.mockResolvedValue(null);
  appendArtifactProvenanceOmission.mockClear();
});

describe('captureArtifactsFromTurn', () => {
  it('captures nothing from plain prose', async () => {
    const { result } = await run('no markers at all');
    expect(result).toEqual({ plan: null, artifact: null, error: null });
    expect(upsertPlan).not.toHaveBeenCalled();
    expect(createArtifact).not.toHaveBeenCalled();
  });

  it('keeps legacy plan markers working', async () => {
    await run('<<plan>>\nShip it\nstep one\n<</plan>>');
    expect(upsertPlan).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Ship it', bodyMd: 'step one' }),
    );
    expect(createArtifact).not.toHaveBeenCalled();
  });

  it('captures a plan envelope through the plan path', async () => {
    const body = JSON.stringify({
      title: 'Envelope plan',
      format: 'markdown',
      content: 'step one',
      metadata: { clusters: [{ title: 'move files', instructions: 'move them' }] },
    });
    await run(`<<artifact v=1 kind=plan>>\n${body}\n<</artifact>>`);
    expect(upsertPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Envelope plan',
        clusters: [{ title: 'move files', instructions: 'move them' }],
      }),
    );
    expect(createArtifact).not.toHaveBeenCalled();
  });

  it('creates an independent artifact for a report and stamps the source turn', async () => {
    const body = JSON.stringify({
      title: 'Session report',
      format: 'markdown',
      content: '## Outcome',
      metadata: { reportType: 'session-summary' },
    });
    const { patches, result } = await run(`<<artifact v=1 kind=report>>\n${body}\n<</artifact>>`);
    expect(createArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'report',
        title: 'Session report',
        sourceFormat: 'markdown',
        sourceTurnId: RUN_ID,
      }),
    );
    expect(upsertPlan).not.toHaveBeenCalled();
    expect(result.artifact).not.toBeNull();
    expect(patches.some((patch) => 'sessionArtifacts' in patch)).toBe(true);
  });

  const wireframeTurn = (fidelity: string): string =>
    `<<artifact v=1 kind=wireframe>>\n${JSON.stringify({
      title: 'Onboarding',
      format: 'json',
      content: WIREFRAME_DOCUMENT,
      metadata: { fidelity, designProfile: { tokens: 1 } },
    })}\n<</artifact>>`;

  it('creates a wireframe artifact with the json source', async () => {
    loadArtifactProvenance.mockResolvedValue({ designProfileSummary: 'tailwind config' });
    await run(wireframeTurn('high'), 'High fidelity');
    expect(createArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'wireframe',
        sourceFormat: 'json',
        sourceText: JSON.stringify(WIREFRAME_DOCUMENT),
        metadata: { fidelity: 'high', designProfile: { tokens: 1 } },
      }),
    );
    expect(appendArtifactProvenanceOmission).not.toHaveBeenCalled();
  });

  it('forces low fidelity and notes the downgrade when no design source survived', async () => {
    loadArtifactProvenance.mockResolvedValue({ designProfileSummary: null });
    await run(wireframeTurn('high'), 'High fidelity');
    expect(createArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { fidelity: 'low', designProfile: { tokens: 1 } } }),
    );
    expect(appendArtifactProvenanceOmission).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: AGENT_ID }),
    );
  });

  it('forces low fidelity when the user asked for a plain wireframe', async () => {
    loadArtifactProvenance.mockResolvedValue({ designProfileSummary: 'tailwind config' });
    await run(wireframeTurn('high'), 'Low fidelity');
    expect(createArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { fidelity: 'low', designProfile: { tokens: 1 } } }),
    );
    expect(appendArtifactProvenanceOmission).not.toHaveBeenCalled();
  });

  it('notes the downgrade on a high fidelity request the agent reported as low', async () => {
    loadArtifactProvenance.mockResolvedValue({ designProfileSummary: null });
    await run(wireframeTurn('low'), 'High fidelity');
    expect(createArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { fidelity: 'low', designProfile: { tokens: 1 } } }),
    );
    expect(appendArtifactProvenanceOmission).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: AGENT_ID }),
    );
  });

  it('leaves a low fidelity claim alone without a downgrade note', async () => {
    await run(wireframeTurn('low'), 'Low fidelity');
    expect(createArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { fidelity: 'low', designProfile: { tokens: 1 } } }),
    );
    expect(appendArtifactProvenanceOmission).not.toHaveBeenCalled();
  });

  it('rejects a malformed wireframe document instead of storing it', async () => {
    const body = JSON.stringify({
      title: 'Onboarding',
      format: 'json',
      content: { screens: [] },
    });
    const { result } = await run(`<<artifact v=1 kind=wireframe>>\n${body}\n<</artifact>>`);
    expect(result.error).toMatchObject({ code: 'invalid_payload' });
    expect(result.artifact).toBeNull();
    expect(createArtifact).not.toHaveBeenCalled();
  });

  it('returns a structured error for a malformed block and writes nothing', async () => {
    const { result } = await run('<<artifact v=1 kind=report>>\n{broken\n<</artifact>>');
    expect(result.error).toMatchObject({ code: 'invalid_json' });
    expect(result.plan).toBeNull();
    expect(result.artifact).toBeNull();
    expect(createArtifact).not.toHaveBeenCalled();
    expect(upsertPlan).not.toHaveBeenCalled();
  });

  it('ignores an envelope quoted inside a code fence', async () => {
    const text = [
      'the shape is:',
      '```text',
      '<<artifact v=1 kind=report>>',
      '{"title":"Example","content":"body"}',
      '<</artifact>>',
      '```',
    ].join('\n');
    const { result } = await run(text);
    expect(result).toEqual({ plan: null, artifact: null, error: null });
  });

  it('stores one artifact when the same turn is captured twice', async () => {
    const stored = new Map<string, { readonly id: string; readonly sourceTurnId: string }>();
    createArtifact.mockImplementation(async (args: { readonly sourceTurnId: string }) => {
      const existing = stored.get(args.sourceTurnId);
      if (existing !== undefined) {
        return existing;
      }
      const created = { id: `artifact-${stored.size + 1}`, sourceTurnId: args.sourceTurnId };
      stored.set(args.sourceTurnId, created);
      return created;
    });
    const body = JSON.stringify({ title: 'Session report', content: '## Outcome' });
    const text = `<<artifact v=1 kind=report>>\n${body}\n<</artifact>>`;

    const first = await run(text);
    const second = await run(text);

    expect(stored.size).toBe(1);
    expect(second.result.artifact).toEqual(first.result.artifact);
  });

  it('gives the plan path the same replay key as the artifact path', async () => {
    await run('<<plan>>\nShip it\nstep one\n<</plan>>');
    expect(upsertPlan).toHaveBeenCalledWith(expect.objectContaining({ sourceTurnId: RUN_ID }));
  });
});
