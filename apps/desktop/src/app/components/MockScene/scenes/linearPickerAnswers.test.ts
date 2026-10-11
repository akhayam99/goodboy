import { describe, expect, it } from 'vitest';
import { LINEAR_PICKER_ANSWERS } from './linearPickerAnswers';
import { startInboxIpc } from './u23/StartInboxScene';

describe('linear picker answers in mock scenes', () => {
  it('answers the state and the people pickers with more than one choice', () => {
    const states = LINEAR_PICKER_ANSWERS['linear_fetch_team_states']?.();
    const members = LINEAR_PICKER_ANSWERS['linear_fetch_team_members']?.();

    expect(Array.isArray(states) ? states.length : 0).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(members) ? members.length : 0).toBeGreaterThanOrEqual(2);
  });

  it('serves the start from inbox scene the same picker rows', () => {
    const states = startInboxIpc({ command: 'linear_fetch_team_states', payload: null });

    expect(states).toEqual(LINEAR_PICKER_ANSWERS['linear_fetch_team_states']?.());
  });
});
