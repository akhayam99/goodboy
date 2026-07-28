import { describe, expect, it } from 'vitest';
import { matchCursorMaxModeFailure } from './matchCursorMaxModeFailure';

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
});
