import { describe, expect, it } from 'vitest';
import { cursorMaxModeMessage, matchCursorMaxModeFailure } from './matchCursorMaxModeFailure';

describe('matchCursorMaxModeFailure', () => {
  it('extracts the model from the Cursor ActionRequiredError payload', () => {
    expect(
      matchCursorMaxModeFailure({
        message:
          'ActionRequiredError: Max Mode Required. The model "gpt-5.5-high" requires Max Mode to be enabled.',
      }),
    ).toEqual({ model: 'gpt-5.5-high' });
  });

  it('ignores unrelated provider failures', () => {
    expect(matchCursorMaxModeFailure({ message: 'cursor exited with code 1' })).toBeNull();
  });

  it('explains that Cursor rejected Max Mode', () => {
    expect(cursorMaxModeMessage({ model: 'gpt-5.5-high' })).toBe(
      'Cursor rejected Max Mode for "gpt-5.5-high". Check that Max Mode (usage-based pricing) is available on your Cursor account, then retry.',
    );
  });
});
