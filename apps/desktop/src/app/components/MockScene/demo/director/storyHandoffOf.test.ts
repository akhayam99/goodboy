import { describe, expect, it } from 'vitest';
import { storyHandoffOf } from './storyHandoffOf';

describe('the planner handoff line', () => {
  it('says the plan follows the recommended answer', () => {
    expect(storyHandoffOf({ answer: 'Return the original credit' })).toContain(
      'A repeated webhook returns the original credit, so I wrote the plan around that.',
    );
  });

  it('does not claim the plan follows another answer it does not follow', () => {
    const line = storyHandoffOf({ answer: 'Reject it with a 409' });

    expect(line).toContain('You chose "Reject it with a 409".');
    expect(line).toContain('This plan still returns the original credit');
    expect(line).not.toContain('so I wrote the plan around that');
  });
});
