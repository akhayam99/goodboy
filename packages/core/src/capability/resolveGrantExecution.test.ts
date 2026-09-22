import { describe, expect, it } from 'vitest';
import { isDelegationGranted } from '../roles';
import {
  canAssumeRemainder,
  resolveContinuationEligibility,
  resolveGrantExecution,
  verificationRoleForGrant,
  type ContinuationEligibility,
} from './resolveGrantExecution';

describe('resolveContinuationEligibility', () => {
  it('certifies a launcher that passes the session id with an exercised session', () => {
    expect(
      resolveContinuationEligibility({
        providerId: 'anthropic',
        binary: 'claude',
        providerSessionId: 'sess-1',
        providerSessionProviderId: 'anthropic',
      }),
    ).toEqual({ kind: 'certified', launcher: 'claude' });
  });

  it('refuses a launcher that discards the resume session id', () => {
    const eligibility = resolveContinuationEligibility({
      providerId: 'codex',
      binary: 'codex',
      providerSessionId: 'sess-1',
      providerSessionProviderId: 'codex',
    });
    expect(eligibility.kind).toBe('ineligible');
  });

  it('refuses a supported launcher that was never exercised', () => {
    const eligibility = resolveContinuationEligibility({
      providerId: 'anthropic',
      binary: 'claude',
      providerSessionId: null,
      providerSessionProviderId: null,
    });
    expect(eligibility).toEqual({
      kind: 'ineligible',
      reason: 'claude never returned a session id for this agent, so its resumption is unexercised',
    });
  });

  it('refuses a session id issued by another provider', () => {
    const eligibility = resolveContinuationEligibility({
      providerId: 'anthropic',
      binary: 'claude',
      providerSessionId: 'sess-1',
      providerSessionProviderId: 'opencode',
    });
    expect(eligibility.kind).toBe('ineligible');
  });

  it('falls back to the provider default launcher', () => {
    expect(
      resolveContinuationEligibility({
        providerId: 'gemini',
        binary: null,
        providerSessionId: 'sess-1',
        providerSessionProviderId: 'gemini',
      }).kind,
    ).toBe('ineligible');
  });
});

describe('resolveGrantExecution', () => {
  const certified = {
    kind: 'certified',
    launcher: 'claude',
  } satisfies ContinuationEligibility;
  const ineligible = {
    kind: 'ineligible',
    reason: 'codex discards the resume session id, so this parent cannot continue natively',
  } satisfies ContinuationEligibility;

  it('continues the parent when the launcher is certified', () => {
    expect(
      resolveGrantExecution({
        requesterRole: 'implementer',
        requestedContinuation: 'resume',
        grantedRole: 'investigator',
        eligibility: certified,
      }),
    ).toEqual({ kind: 'resume', launcher: 'claude' });
  });

  it('transfers the remaining work to the child when its role permits both', () => {
    expect(
      resolveGrantExecution({
        requesterRole: 'implementer',
        requestedContinuation: 'resume',
        grantedRole: 'investigator',
        eligibility: ineligible,
      }),
    ).toEqual({
      kind: 'transfer',
      childOwnsRemainder: true,
      replacementRole: null,
      reason: ineligible.reason,
    });
  });

  it('names a replacement when the specialist cannot carry the remainder', () => {
    expect(
      resolveGrantExecution({
        requesterRole: 'implementer',
        requestedContinuation: 'resume',
        grantedRole: 'scout',
        eligibility: ineligible,
      }),
    ).toEqual({
      kind: 'transfer',
      childOwnsRemainder: false,
      replacementRole: 'implementer',
      reason: ineligible.reason,
    });
  });

  it('hands the obligation to the run when the requester finished its assignment', () => {
    expect(
      resolveGrantExecution({
        requesterRole: 'reviewer',
        requestedContinuation: 'handoff',
        grantedRole: 'implementer',
        eligibility: certified,
      }),
    ).toEqual({ kind: 'handoff' });
  });

  it('transfers when the requester asked to transfer even on a certified launcher', () => {
    const plan = resolveGrantExecution({
      requesterRole: 'implementer',
      requestedContinuation: 'transfer',
      grantedRole: 'investigator',
      eligibility: certified,
    });
    expect(plan.kind).toBe('transfer');
  });
});

describe('canAssumeRemainder', () => {
  it('refuses every read-only granted role', () => {
    expect(canAssumeRemainder({ remainderRole: 'implementer', grantedRole: 'scout' })).toBe(false);
  });

  it('lets a replacement planner own an unfinished plan', () => {
    expect(canAssumeRemainder({ remainderRole: 'planner', grantedRole: 'planner' })).toBe(true);
  });
});

describe('the reviewer never becomes the fixer', () => {
  it('denies a reviewer requesting a reviewer for a repair', () => {
    expect(
      isDelegationGranted({ requester: 'reviewer', target: 'reviewer', purpose: 'repair' }),
    ).toBe(false);
  });

  it('routes a reviewer repair to an implementer', () => {
    expect(
      isDelegationGranted({ requester: 'reviewer', target: 'implementer', purpose: 'repair' }),
    ).toBe(true);
  });

  it('routes a tester production failure to an implementer, not to a tester', () => {
    expect(
      isDelegationGranted({ requester: 'tester', target: 'implementer', purpose: 'repair' }),
    ).toBe(true);
    expect(isDelegationGranted({ requester: 'tester', target: 'tester', purpose: 'repair' })).toBe(
      false,
    );
  });

  it('verifies a repair with a reviewer and a test obligation with a tester', () => {
    expect(verificationRoleForGrant({ purpose: 'repair' })).toBe('reviewer');
    expect(verificationRoleForGrant({ purpose: 'test' })).toBe('tester');
    expect(verificationRoleForGrant({ purpose: 'discovery' })).toBeNull();
  });
});
