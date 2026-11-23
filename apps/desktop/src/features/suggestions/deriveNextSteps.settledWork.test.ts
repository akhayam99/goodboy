// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import { deriveNextSteps } from './deriveNextSteps';
import type { NextStepSignals } from './nextStepSignals';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const MERGED_MOUNT = brandId<MountId>({ value: 'mount-payments-api' });
const OPEN_MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });

const BASE: NextStepSignals = {
  sessionId: SESSION,
  workflowRuns: [],
  plans: [],
  consumedPlanIds: new Set(),
  openQuestionCount: 0,
  hasPullRequest: false,
  eligibleThreadCount: 0,
  mountEvents: [],
  projects: [],
};

type ReviewParams = {
  readonly reviewMountId: MountId;
};

const isResolveOfferedFor = ({ reviewMountId }: ReviewParams): boolean =>
  deriveNextSteps({
    signals: {
      ...BASE,
      eligibleThreadCount: 2,
      reviewMountId,
      settledMountIds: [MERGED_MOUNT],
      settledBranches: { merged: 0, closed: 0 },
    },
  }).some((suggestion) => suggestion.kind === 'resolve-threads');

describe('deriveNextSteps for settled work', () => {
  it('drops the review conversations of a merged request while another branch stays open', () => {
    expect(isResolveOfferedFor({ reviewMountId: MERGED_MOUNT })).toBe(false);
    expect(isResolveOfferedFor({ reviewMountId: OPEN_MOUNT })).toBe(true);
  });
});
