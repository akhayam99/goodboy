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

  it('says the project sets the merge method on GitLab', () => {
    expect(capabilityReasonOf({ kind: 'gitlab', capability: 'canChooseMergeMethod' })).toBe(
      'Set by the project',
    );
  });

  it('names the noun and the host for a write that is not built yet', () => {
    expect(capabilityReasonOf({ kind: 'gitlab', capability: 'canEditTitle' })).toBe(
      'Goodboy cannot edit the title of a merge request on GitLab yet',
    );
    expect(capabilityReasonOf({ kind: 'bitbucket', capability: 'canRequestReviewers' })).toBe(
      'Goodboy cannot request reviewers for a pull request on Bitbucket yet',
    );
  });
});
