// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId, OpenQuestionId } from '@goodboy/types';
import type { AskHandle } from './askHandles';
import { parseAskAnswer, stabilizeAskAnswer } from './parseAskAnswer';

const HANDLES: ReadonlyArray<AskHandle> = [
  { key: 'A2', label: 'Implementer', target: { kind: 'agent', agentId: 'agent-impl' as AgentId } },
  {
    key: 'Q1',
    label: 'Question 1',
    target: { kind: 'question', questionId: 'q-1' as OpenQuestionId },
  },
  { key: 'PR', label: '#318', target: { kind: 'pr', number: 318 } },
];

const ANSWER = [
  '**One question is blocking, see [[Q1]].** [[A2]] is still working.',
  '- [[A2]] works on [[webhook.ts:88]] for [[PR]]',
  '- [[A9]] does not exist',
  '<<suggest target="Q1">>Stop after 5 attempts.<</suggest>>',
].join('\n');

describe('parseAskAnswer', () => {
  it('turns handles into chips and keeps the first sentence bold', () => {
    const parsed = parseAskAnswer({ text: ANSWER, handles: HANDLES });
    expect(parsed.blocks.map((block) => block.kind)).toEqual(['paragraph', 'item', 'item']);
    const first = parsed.blocks[0]?.inlines ?? [];
    expect(first[0]).toEqual({
      kind: 'text',
      text: 'One question is blocking, see ',
      isBold: true,
    });
    expect(first[1]).toMatchObject({ kind: 'chip', handle: { key: 'Q1' } });
    expect(first[2]).toEqual({ kind: 'text', text: '.', isBold: true });
    expect(parsed.cited.map((handle) => handle.label)).toEqual([
      'Question 1',
      'Implementer',
      'webhook.ts:88',
      '#318',
    ]);
  });

  it('shows an unknown handle as plain text, never as a chip', () => {
    const parsed = parseAskAnswer({ text: ANSWER, handles: HANDLES });
    expect(parsed.blocks[2]?.inlines).toEqual([
      { kind: 'text', text: 'A9', isBold: false },
      { kind: 'text', text: ' does not exist', isBold: false },
    ]);
  });

  it('reads a suggestion only for a question or an agent and strips it from the text', () => {
    const parsed = parseAskAnswer({ text: ANSWER, handles: HANDLES });
    expect(parsed.suggestion).toEqual({ handle: HANDLES[1], text: 'Stop after 5 attempts.' });
    const onPr = parseAskAnswer({
      text: 'Done. <<suggest target="PR">>merge it<</suggest>>',
      handles: HANDLES,
    });
    expect(onPr.suggestion).toBeNull();
  });

  it('hides a marker that is still streaming', () => {
    const parsed = parseAskAnswer({ text: '**Yes.** see [[Q', handles: HANDLES });
    expect(parsed.blocks[0]?.inlines.map((inline) => inline.kind)).toEqual(['text', 'text']);
    const suggesting = parseAskAnswer({
      text: 'Yes. <<suggest target="Q1">>Stop',
      handles: HANDLES,
    });
    expect(suggesting.suggestion).toBeNull();
    expect(JSON.stringify(suggesting.blocks)).not.toContain('suggest');
  });

  it('saves chips that still resolve after a reload, without the pack', () => {
    const saved = stabilizeAskAnswer({ text: ANSWER, handles: HANDLES });
    expect(saved).toContain('[[agent:agent-impl|Implementer]]');
    expect(saved).toContain('[[file:webhook.ts#88|webhook.ts:88]]');
    expect(saved).toContain('<<suggest target="question:q-1">>');
    const reloaded = parseAskAnswer({ text: saved, handles: [] });
    expect(reloaded.cited.map((handle) => handle.target)).toEqual([
      { kind: 'question', questionId: 'q-1' },
      { kind: 'agent', agentId: 'agent-impl' },
      { kind: 'file', path: 'webhook.ts', line: 88 },
      { kind: 'pr', number: 318 },
    ]);
    expect(reloaded.suggestion?.handle.target).toEqual({ kind: 'question', questionId: 'q-1' });
  });
});
