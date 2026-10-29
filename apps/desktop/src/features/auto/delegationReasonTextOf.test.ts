import { describe, expect, it } from 'vitest';
import { delegationReasonTextOf } from './delegationReasonTextOf';

describe('delegationReasonTextOf', () => {
  it('words a known reason code', () => {
    expect(delegationReasonTextOf({ reason: 'deadline_passed' })).toBe('It ran out of time.');
  });

  it('words a report the role never wrote apart from one it could not save', () => {
    expect(delegationReasonTextOf({ reason: 'report_missing' })).toBe(
      'It ended without writing its report.',
    );
    expect(delegationReasonTextOf({ reason: 'artifact_persistence_failed' })).toBe(
      'Its result could not be saved.',
    );
  });

  it('shows a sentence the failure already wrote for the person', () => {
    const reason =
      "Couldn't open the pull request: the branch isn't on GitHub yet. Push it and retry.";

    expect(delegationReasonTextOf({ reason })).toBe(reason);
  });

  it('hides an unknown code', () => {
    expect(delegationReasonTextOf({ reason: 'agent_not_created: spawn failed' })).toBeNull();
    expect(delegationReasonTextOf({ reason: 'something_new' })).toBeNull();
  });

  it('answers nothing for no reason', () => {
    expect(delegationReasonTextOf({ reason: null })).toBeNull();
  });
});
