import { describe, expect, it } from 'vitest';
import { aSession, anAgent, TEST_NOW } from '@goodboy/types/testing';
import { selectCheckAnalysis } from './selectCheckAnalysis';

const sessionId = aSession().id;
const url = 'https://github.com/harborline/payments-api/actions/runs/31/job/42';
const older = anAgent({ sessionId, ordinal: 1, sourceKind: 'failed_check', sourceCommentUrl: url });
const newer = anAgent({ sessionId, ordinal: 2, sourceKind: 'failed_check', sourceCommentUrl: url });

describe('check analysis identity', () => {
  it('keeps the newest matching attempt even when an older one arrives late', () => {
    expect(
      selectCheckAnalysis({
        sessionId,
        url,
        state: { sessionPhaseRuns: { [sessionId]: [newer, older] } },
      }),
    ).toBe(newer);
  });
  it('ignores deleted agents, other source kinds, URLs and sessions', () => {
    const other = aSession().id;
    expect(
      selectCheckAnalysis({
        sessionId,
        url,
        state: {
          sessionPhaseRuns: {
            [sessionId]: [
              older,
              { ...newer, deletedAt: TEST_NOW },
              { ...newer, sourceCommentUrl: url + '1' },
              { ...newer, sourceKind: 'review_comment' },
            ],
            [other]: [newer],
          },
        },
      }),
    ).toBe(older);
    expect(selectCheckAnalysis({ sessionId, url, state: { sessionPhaseRuns: {} } })).toBeNull();
  });
});
