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
    createArtifact: vi.fn(async () => ({ id: 'artifact-1' })),
    listArtifactsForSession: vi.fn(async () => [] as ReadonlyArray<unknown>),
  }),
);

vi.mock('../features/plans/plans', () => ({ upsertPlan, listPlansForSession }));
vi.mock('../features/artifacts/artifacts', () => ({ createArtifact, listArtifactsForSession }));

import { captureArtifactsFromTurn } from './turn-helpers';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;

type StatePatch = Readonly<Record<string, unknown>>;

const harness = () => {
  const patches: StatePatch[] = [];
  const set = ((updater: (state: StatePatch) => StatePatch) => {
    patches.push(updater({ sessionPlans: {}, sessionArtifacts: {} }));
  }) as never;
  return { patches, set };
};

const run = async (assistantText: string) => {
  const { patches, set } = harness();
  const result = await captureArtifactsFromTurn({
    set,
    sessionId: SESSION_ID,
    agentId: AGENT_ID,
    assistantText,
    emittingProvider: null,
    sourceTurnId: RUN_ID,
  });
  return { patches, result };
};

beforeEach(() => {
  upsertPlan.mockClear();
  listPlansForSession.mockClear();
  createArtifact.mockClear();
  listArtifactsForSession.mockClear();
  listPlansForSession.mockResolvedValue([]);
  listArtifactsForSession.mockResolvedValue([]);
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

  it('creates a wireframe artifact with the json source', async () => {
    const body = JSON.stringify({
      title: 'Onboarding',
      format: 'json',
      content: { screens: [] },
      metadata: { fidelity: 'high', designProfile: { tokens: 1 } },
    });
    await run(`<<artifact v=1 kind=wireframe>>\n${body}\n<</artifact>>`);
    expect(createArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'wireframe',
        sourceFormat: 'json',
        sourceText: '{"screens":[]}',
        metadata: { fidelity: 'high', designProfile: { tokens: 1 } },
      }),
    );
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

  it('passes the same source turn id on replay so the write can dedupe', async () => {
    const body = JSON.stringify({ title: 'Session report', content: '## Outcome' });
    const text = `<<artifact v=1 kind=report>>\n${body}\n<</artifact>>`;
    await run(text);
    await run(text);
    expect(createArtifact).toHaveBeenCalledTimes(2);
    const calls = createArtifact.mock.calls as ReadonlyArray<
      ReadonlyArray<{ sourceTurnId: string }>
    >;
    expect(calls[0]?.[0]?.sourceTurnId).toBe(RUN_ID);
    expect(calls[1]?.[0]?.sourceTurnId).toBe(RUN_ID);
  });
});
