// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hiddenModelNote } from './hiddenModelNote';

describe('hiddenModelNote', () => {
  it('says a hidden background model still runs and for what', () => {
    expect(
      hiddenModelNote({
        provider: 'anthropic',
        model: 'haiku-4.5',
        isPinned: false,
        job: 'Step summaries',
      }),
    ).toBe('Haiku 4.5 · hidden, still used for step summaries');
  });

  it('says a pinned hidden model keeps running because of the pin', () => {
    expect(
      hiddenModelNote({ provider: 'anthropic', model: 'opus-5.5', isPinned: true, job: 'Planner' }),
    ).toBe('Opus 5.5 · hidden, still runs because you pinned it');
  });
});
