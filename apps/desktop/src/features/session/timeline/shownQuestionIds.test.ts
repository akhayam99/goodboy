import { describe, expect, it } from 'vitest';
import type { Agent, OpenQuestion } from '@goodboy/types';
import type { TimelineStreamItem } from './buildTimelineStream';
import { shownQuestionIds } from './shownQuestionIds';

const question = (id: string): OpenQuestion =>
  ({ id, status: 'open', createdAt: '2026-09-28T09:00:00.000Z' }) as unknown as OpenQuestion;

const row = (fields: Partial<TimelineStreamItem>): TimelineStreamItem =>
  ({
    kind: 'row',
    rowState: { phase: 'done', reason: null, ask: null },
    ...fields,
  }) as TimelineStreamItem;

describe('shownQuestionIds', () => {
  it('collects the questions the rows in view show, once each', () => {
    const asked = question('q-agent');
    const listed = question('q-row');
    const items = [
      row({ entry: { kind: 'question', questions: [listed] } as never }),
      row({
        entry: {
          kind: 'agent',
          agent: { id: 'a' } as Agent,
          openQuestions: [asked, listed],
        } as never,
        rowState: { phase: 'waiting', reason: { kind: 'question', stepLabel: null }, ask: null },
      }),
    ];

    expect([...shownQuestionIds({ items })].sort()).toEqual(['q-agent', 'q-row']);
  });

  it('counts the one question a run row points at, not the rest of the run', () => {
    const pointed = question('q-pointed');
    const items = [
      row({
        entry: { kind: 'run' } as never,
        rowState: {
          phase: 'waiting',
          reason: { kind: 'question', stepLabel: '2' },
          ask: { kind: 'answer', question: pointed },
        },
      }),
    ];

    expect([...shownQuestionIds({ items })]).toEqual(['q-pointed']);
  });

  it('shows nothing for a quiet run row', () => {
    const items = [
      row({
        entry: { kind: 'run' } as never,
        rowState: { phase: 'waiting', reason: { kind: 'stepAsking' }, ask: null },
      }),
    ];

    expect(shownQuestionIds({ items }).size).toBe(0);
  });
});
