// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildAskTurnPrompt } from '../../../../../features/session/ask/buildAskTurnPrompt';
import { askPromptParts } from './mockAskResponder';

describe('the mock Ask responder', () => {
  it('splits the pack from the question the way the real prompt is built', () => {
    const prompt = buildAskTurnPrompt({
      pack: 'PACK: notify-relay',
      history: [],
      question: 'Where does the webhook retry?',
    });

    expect(askPromptParts({ prompt })).toEqual({
      pack: 'PACK: notify-relay\n\n',
      question: 'Where does the webhook retry?',
    });
  });
});
