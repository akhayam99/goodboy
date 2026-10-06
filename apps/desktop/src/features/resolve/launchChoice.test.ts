import { describe, expect, it } from 'vitest';
import { launchChoiceOf, modelChoiceOfLaunch } from './launchChoice';

const CHOICE = launchChoiceOf({
  routing: { provider: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
  commitStyle: 'fixup',
  hint: '  Keep the public API  ',
});

describe('launch choice', () => {
  it('keeps the trimmed hint and turns the choice back into a model choice', () => {
    expect(CHOICE.hint).toBe('Keep the public API');
    expect(modelChoiceOfLaunch({ launchChoice: CHOICE })).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      effort: 'medium',
      hint: 'Keep the public API',
    });
  });

  it('drops an empty hint', () => {
    const choice = launchChoiceOf({
      routing: { provider: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
      commitStyle: null,
      hint: '   ',
    });
    expect(choice.hint).toBeNull();
  });
});
