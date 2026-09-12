import { describe, expect, it } from 'vitest';
import {
  WORKFLOW_RECOVERY_TIER_POLICY_DEFAULT,
  workflowRecoveryTier,
} from './workflowRecoveryTier';

describe('workflowRecoveryTier', () => {
  it('targets the tier of a known pick', () => {
    expect(
      workflowRecoveryTier({ pick: { provider: 'anthropic', model: 'opus-5', effort: null } }),
    ).toBe('expensive');
    expect(
      workflowRecoveryTier({ pick: { provider: 'anthropic', model: 'sonnet-5', effort: null } }),
    ).toBe('mid');
    expect(
      workflowRecoveryTier({ pick: { provider: 'anthropic', model: 'haiku-4.5', effort: null } }),
    ).toBe('cheap');
  });

  it('sends a pick this build does not know to the policy default', () => {
    expect(
      workflowRecoveryTier({ pick: { provider: 'anthropic', model: 'not-a-model', effort: null } }),
    ).toBe(WORKFLOW_RECOVERY_TIER_POLICY_DEFAULT);
  });

  it('sends a missing pick to the policy default', () => {
    expect(workflowRecoveryTier({ pick: null })).toBe(WORKFLOW_RECOVERY_TIER_POLICY_DEFAULT);
  });

  it('keeps the policy default at mid rather than at either end of the catalog', () => {
    expect(WORKFLOW_RECOVERY_TIER_POLICY_DEFAULT).toBe('mid');
  });
});
