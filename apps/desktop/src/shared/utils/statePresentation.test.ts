import { describe, expect, it } from 'vitest';
import { CircleCheck } from 'lucide-react';
import { stateDescription, type StatePresentation } from './statePresentation';

const merged: StatePresentation = {
  label: 'Merged',
  reason: 'integrated into the base branch',
  tone: 'merged',
  icon: CircleCheck,
};

describe('stateDescription', () => {
  it('names the state and the reason when there is no subject', () => {
    expect(stateDescription({ presentation: merged })).toBe(
      'Merged, integrated into the base branch',
    );
  });

  it('leads with the subject the state belongs to', () => {
    expect(stateDescription({ presentation: merged, subject: 'PR #12' })).toBe(
      'PR #12 merged, integrated into the base branch',
    );
  });

  it('drops the trailing clause when a state carries no reason', () => {
    expect(stateDescription({ presentation: { ...merged, reason: '' }, subject: 'PR #12' })).toBe(
      'PR #12 merged',
    );
  });
});
