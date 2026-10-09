// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { capabilityReasonOf } from './pullRequestCapabilityReason';

describe('capabilityReasonOf', () => {
  it('has no reason where the host can do it', () => {
    expect(capabilityReasonOf({ kind: 'github', capability: 'canEditTitle' })).toBeNull();
    expect(capabilityReasonOf({ kind: 'github', capability: 'canSetDraft' })).toBeNull();
  });

  it('says why Bitbucket cannot mark a pull request ready', () => {
    expect(capabilityReasonOf({ kind: 'bitbucket', capability: 'canSetDraft' })).toBe(
      'Bitbucket has no draft pull requests',
    );
  });

  it('has no reason on GitLab, where every write is built', () => {
    expect(capabilityReasonOf({ kind: 'gitlab', capability: 'canEditTitle' })).toBeNull();
    expect(capabilityReasonOf({ kind: 'gitlab', capability: 'canChooseMergeMethod' })).toBeNull();
    expect(capabilityReasonOf({ kind: 'gitlab', capability: 'canReopen' })).toBeNull();
  });

  it('names the noun and the host for a write that is not built', () => {
    expect(capabilityReasonOf({ kind: 'local', capability: 'canEditTitle' })).toMatch(
      /^Goodboy cannot edit the title of a .+ yet$/,
    );
    expect(capabilityReasonOf({ kind: 'local', capability: 'canRequestReviewers' })).toMatch(
      /^Goodboy cannot request reviewers for a .+ yet$/,
    );
  });

  it('says why Bitbucket cannot reopen a declined pull request', () => {
    expect(capabilityReasonOf({ kind: 'bitbucket', capability: 'canReopen' })).toBe(
      "Bitbucket can't reopen a declined pull request",
    );
  });

  it('has nothing to say where Bitbucket can write', () => {
    for (const capability of [
      'canEditTitle',
      'canEditBody',
      'canRequestReviewers',
      'canReadChecks',
      'canChooseMergeMethod',
      'canClose',
    ] as const) {
      expect(capabilityReasonOf({ kind: 'bitbucket', capability })).toBeNull();
    }
  });
});
