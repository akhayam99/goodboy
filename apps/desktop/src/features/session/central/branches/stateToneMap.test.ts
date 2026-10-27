import { describe, expect, it } from 'vitest';
import type { Tone } from '@goodboy/ui';
import type { SessionAttentionReason, SessionPrGroup } from '@goodboy/types';
import {
  PR_GROUP_PRESENTATION,
  PULL_REQUEST_PRESENTATION,
  type PullRequestPresentationState,
} from '../../../../shared/utils/pullRequestPresentation';
import { pullRequestStateToneOf } from '../../../branch/pullRequestStateToneOf';
import { ATTENTION_REASON_META } from '../../session-stage';
import { BRANCH_STATE_TONE, type BranchState } from './branchStateTone';

const EXPECTED_TONE: Readonly<Record<BranchState, Tone>> = {
  unread: 'neutral',
  rebasing: 'info',
  gone: 'warning',
  'nothing-committed': 'neutral',
  'not-pushed': 'neutral',
  'no-request': 'neutral',
  draft: 'neutral',
  open: 'info',
  'checks-running': 'info',
  'checks-failing': 'danger',
  'in-review': 'info',
  'changes-requested': 'warning',
  conflicts: 'warning',
  approved: 'success',
  ready: 'success',
  queued: 'primary',
  merged: 'merged',
  closed: 'neutral',
};

const REQUEST_PAIRS: ReadonlyArray<readonly [PullRequestPresentationState, BranchState]> = [
  ['none', 'no-request'],
  ['draft', 'draft'],
  ['open', 'open'],
  ['approved', 'approved'],
  ['queued', 'queued'],
  ['merged', 'merged'],
  ['closed', 'closed'],
];

const GROUP_PAIRS: ReadonlyArray<readonly [SessionPrGroup, BranchState]> = [
  ['not-open', 'no-request'],
  ['draft', 'draft'],
  ['reviewable', 'in-review'],
  ['reviewed', 'approved'],
  ['queued', 'queued'],
  ['closed', 'closed'],
  ['merged', 'merged'],
];

const REASON_PAIRS: ReadonlyArray<readonly [SessionAttentionReason, BranchState]> = [
  ['ci-failed', 'checks-failing'],
  ['changes-requested', 'changes-requested'],
  ['pr-queued', 'queued'],
  ['pr-approved', 'approved'],
];

describe('one tone per state', () => {
  it('paints every branch state with its one tone', () => {
    expect(BRANCH_STATE_TONE).toEqual(EXPECTED_TONE);
  });

  it('walks every pull request state and every pull request group', () => {
    expect(REQUEST_PAIRS.map(([state]) => state).sort()).toEqual(
      Object.keys(PULL_REQUEST_PRESENTATION).sort(),
    );
    expect(GROUP_PAIRS.map(([group]) => group).sort()).toEqual(
      Object.keys(PR_GROUP_PRESENTATION).sort(),
    );
  });

  it.each(REQUEST_PAIRS)(
    'paints the pull request state %s like the branch state %s',
    (state, branchState) => {
      const tone = BRANCH_STATE_TONE[branchState];
      expect(PULL_REQUEST_PRESENTATION[state].tone).toBe(tone);
      expect(pullRequestStateToneOf({ state }).tone).toBe(tone);
    },
  );

  it.each(GROUP_PAIRS)(
    'paints the pull request group %s like the branch state %s',
    (group, branchState) => {
      expect(PR_GROUP_PRESENTATION[group].tone).toBe(BRANCH_STATE_TONE[branchState]);
    },
  );

  it.each(REASON_PAIRS)(
    'paints the attention reason %s like the branch state %s',
    (reason, branchState) => {
      expect(ATTENTION_REASON_META[reason].tone).toBe(BRANCH_STATE_TONE[branchState]);
    },
  );

  it('keeps violet for merged and green for approved, never for open', () => {
    expect(BRANCH_STATE_TONE.merged).toBe('merged');
    expect(BRANCH_STATE_TONE.approved).toBe('success');
    expect(BRANCH_STATE_TONE.open).not.toBe('success');
  });
});
