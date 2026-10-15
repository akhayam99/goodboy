import { describe, expect, it } from 'vitest';
import { parseRevisionFromTurn } from './revisionParse';

const block = (kind: string, payload: Readonly<Record<string, unknown>>): string =>
  `Here it is.\n<<artifact v=1 kind=${kind}>>\n${JSON.stringify(payload)}\n<</artifact>>\n<<step-done id="agent-planner-1">>`;

const plan = (overrides: Readonly<Record<string, unknown>> = {}): string =>
  block('plan', {
    title: 'Plan for notify-relay',
    format: 'markdown',
    content: '# Plan v2',
    ...overrides,
  });

describe('reading the new version a revise turn wrote', () => {
  it('takes the one block of the right kind as the new version', () => {
    expect(
      parseRevisionFromTurn({ assistantText: plan(), expectedKind: 'plan', baseClusterCount: 0 }),
    ).toEqual({
      kind: 'ok',
      title: 'Plan for notify-relay',
      sourceText: '# Plan v2',
      metadata: {},
    });
  });

  it('answers no new version for a prose reply, a broken block and a block of another kind', () => {
    for (const assistantText of [
      'I changed nothing, it already says that.',
      '<<artifact v=1 kind=plan>>\n{broken\n<</artifact>>',
      block('report', { title: 'A report', format: 'markdown', content: 'text' }),
    ]) {
      expect(
        parseRevisionFromTurn({ assistantText, expectedKind: 'plan', baseClusterCount: 0 }),
      ).toEqual({ kind: 'failed', reason: 'no_new_version' });
    }
  });

  it('answers no new version for two blocks and for an empty title', () => {
    expect(
      parseRevisionFromTurn({
        assistantText: `${plan()}\n${plan({ content: 'another' })}`,
        expectedKind: 'plan',
        baseClusterCount: 0,
      }),
    ).toEqual({ kind: 'failed', reason: 'no_new_version' });
    expect(
      parseRevisionFromTurn({
        assistantText: plan({ title: '   ' }),
        expectedKind: 'plan',
        baseClusterCount: 0,
      }),
    ).toEqual({ kind: 'failed', reason: 'no_new_version' });
  });

  it('refuses a plan that dropped its parallel parts and keeps one that changed them', () => {
    expect(
      parseRevisionFromTurn({ assistantText: plan(), expectedKind: 'plan', baseClusterCount: 3 }),
    ).toEqual({ kind: 'failed', reason: 'lost_structure' });
    const kept = plan({
      metadata: { clusters: [{ title: 'move files', instructions: 'move them' }] },
    });
    expect(
      parseRevisionFromTurn({ assistantText: kept, expectedKind: 'plan', baseClusterCount: 3 }),
    ).toMatchObject({ kind: 'ok', metadata: { clusters: [{ title: 'move files' }] } });
  });

  it('lets a plan with one part or none drop its structure', () => {
    expect(
      parseRevisionFromTurn({ assistantText: plan(), expectedKind: 'plan', baseClusterCount: 1 }),
    ).toMatchObject({ kind: 'ok' });
  });
});
