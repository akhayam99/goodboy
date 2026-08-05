import { describe, expect, it } from 'vitest';
import { prActionBlockReason } from './prActionBlockReason';

describe('prActionBlockReason', () => {
  it('names the resolution gap when goodboy has no target to write to', () => {
    const reason = prActionBlockReason({
      canAct: false,
      isBusy: false,
      requiresIdentity: false,
      vote: 'none',
    });
    expect(reason).toContain('still resolving');
  });

  it('names the write already in flight', () => {
    const reason = prActionBlockReason({
      canAct: true,
      isBusy: true,
      requiresIdentity: false,
      vote: 'none',
    });
    expect(reason).toContain('still running');
  });

  it('blocks a vote when goodboy does not know which account is mine', () => {
    const reason = prActionBlockReason({
      canAct: true,
      isBusy: false,
      requiresIdentity: true,
      vote: 'unknown',
    });
    expect(reason).toContain('Reconnect Bitbucket');
  });

  it('lets merge and decline through on an unknown identity', () => {
    const reason = prActionBlockReason({
      canAct: true,
      isBusy: false,
      requiresIdentity: false,
      vote: 'unknown',
    });
    expect(reason).toBeNull();
  });
});
