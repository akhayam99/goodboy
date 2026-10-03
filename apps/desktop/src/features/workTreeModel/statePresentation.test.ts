import { describe, expect, it } from 'vitest';
import type { ReviewCommentState } from '../resolve/reviewCommentState';
import { resolverRowState } from '../session/timeline/resolveActivity';
import { statePresentationOf } from './statePresentation';
import type { RowState } from './rowState';

const reviewRow = ({
  state,
  word,
}: {
  readonly state: ReviewCommentState;
  readonly word: string;
}) => statePresentationOf({ state: resolverRowState({ facts: { state, word } }) });

describe('statePresentationOf', () => {
  it('turns the quiet final review states into an icon that keeps its word', () => {
    const quiet = [
      ['pushed', 'Pushed'],
      ['accepted', 'Accepted'],
      ['resolved', 'Resolved on GitHub'],
      ['replied', 'Reply only'],
      ['skipped', 'Skipped'],
    ] as const;

    for (const [state, word] of quiet) {
      const shown = reviewRow({ state, word });
      expect(shown?.icon).not.toBeNull();
      expect(shown?.word).toBe(word);
    }
  });

  it('keeps every review state that asks for you as a word', () => {
    const asking = [
      ['needs', 'Needs you'],
      ['ready', 'Ready for you'],
      ['failed', 'Draft failed'],
      ['drafting', 'Drafting'],
      ['outdated', 'Comment changed'],
    ] as const;

    for (const [state, word] of asking) {
      const shown = reviewRow({ state, word });
      expect(shown?.icon).toBeNull();
      expect(shown?.short).toBe(word);
    }
  });

  it('gives a closed and a skipped agent an icon, and a question or a ready step a word', () => {
    const closed: RowState = { phase: 'closed', reason: { kind: 'closed' }, ask: null };
    const skipped: RowState = { phase: 'skipped', reason: { kind: 'skipped' }, ask: null };
    const asking: RowState = {
      phase: 'waiting',
      reason: { kind: 'question', stepLabel: '2' },
      ask: { kind: 'answer', question: null },
    };
    const ready: RowState = {
      phase: 'waiting',
      reason: { kind: 'ready', stepLabel: '3' },
      ask: null,
    };

    expect(statePresentationOf({ state: closed })?.icon).not.toBeNull();
    expect(statePresentationOf({ state: skipped })?.icon).not.toBeNull();
    expect(statePresentationOf({ state: asking })).toMatchObject({
      icon: null,
      word: 'Needs your answer in step 2',
      short: 'Needs you',
      tone: 'warning',
    });
    expect(statePresentationOf({ state: ready })).toMatchObject({
      icon: null,
      short: 'Step 3 ready',
    });
  });

  it('says nothing for a row that has no state to say', () => {
    expect(statePresentationOf({ state: { phase: 'done', reason: null, ask: null } })).toBeNull();
    expect(
      statePresentationOf({ state: { phase: 'running', reason: null, ask: null } }),
    ).toBeNull();
  });
});
