import { describe, expect, it } from 'vitest';
import { buildArtifactBodiesBlock, buildStateDigest, type DigestDelegation } from './digest';
import { AUTO_DELIVERY_ARTIFACT_CHARS, AUTO_DIGEST_SETTLED_MAX } from './limits';

const NOW = 1_000_000_000;
const MINUTE = 60_000;

const delegation = (overrides: Partial<DigestDelegation>): DigestDelegation => ({
  id: 'd1',
  role: 'scout',
  state: 'running',
  outcome: null,
  task: 'Find the retry limit.',
  createdAt: NOW - 4 * MINUTE,
  question: null,
  ...overrides,
});

describe('buildStateDigest', () => {
  it('says so when nothing has started', () => {
    expect(buildStateDigest({ delegations: [], nowMs: NOW })).toContain(
      'No agent has been started',
    );
  });

  it('lists an open agent with its role, state, age and task', () => {
    const text = buildStateDigest({ delegations: [delegation({})], nowMs: NOW });

    expect(text).toContain('- d1 scout, running for 4 min: Find the retry limit.');
    expect(text).not.toContain('No agent is open');
  });

  it('shows a paused agent with the question it waits on', () => {
    const text = buildStateDigest({
      delegations: [
        delegation({
          state: 'paused',
          question: { questionId: 'q1', text: 'Which mount?\nThe first or the second' },
        }),
      ],
      nowMs: NOW,
    });

    expect(text).toContain(
      '- d1 scout, waiting for your answer (question q1): Which mount? The first or the second',
    );
  });

  it('lists settled agents by outcome and caps them', () => {
    const settled = Array.from({ length: AUTO_DIGEST_SETTLED_MAX + 2 }, (_, index) =>
      delegation({ id: `s${index}`, state: 'settled', outcome: 'completed' }),
    );
    const text = buildStateDigest({ delegations: settled, nowMs: NOW });

    expect(text).toContain('No agent is open.');
    expect(text).toContain('s13 scout completed');
    expect(text).not.toContain('s0 scout');
    expect(text).toContain('2 earlier not shown');
  });
});

describe('buildArtifactBodiesBlock', () => {
  const artifact = (id: string, body: string) => ({
    id,
    kind: 'report',
    title: `Report ${id}`,
    revision: 2,
    body,
  });

  it('is empty without artifacts', () => {
    expect(buildArtifactBodiesBlock({ artifacts: [] })).toBe('');
  });

  it('inlines a short body whole', () => {
    expect(buildArtifactBodiesBlock({ artifacts: [artifact('a1', 'Three callers.')] })).toBe(
      'ARTIFACT a1 (report) "Report a1" v2\nThree callers.',
    );
  });

  it('cuts a long body and says how much was left out', () => {
    const body = 'x'.repeat(AUTO_DELIVERY_ARTIFACT_CHARS + 10);
    const text = buildArtifactBodiesBlock({ artifacts: [artifact('a1', body)] });

    expect(text).toContain('[cut: 10 more characters]');
    expect(text.length).toBeLessThan(body.length + 200);
  });

  it('stops inlining when the total room is used', () => {
    const body = 'y'.repeat(AUTO_DELIVERY_ARTIFACT_CHARS);
    const text = buildArtifactBodiesBlock({
      artifacts: ['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => artifact(id, body)),
    });

    expect(text).toContain('ARTIFACT a4');
    expect(text).toContain('v2\n[text not shown');
  });
});
