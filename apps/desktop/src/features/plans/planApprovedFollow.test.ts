import { describe, expect, it } from 'vitest';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { sessionPlace } from '../../store/slices/navigation/place';
import { planApprovedFollowOf } from './planApprovedFollow';

const SESSION = 'session-harborline' as SessionId;
const RUN = 'run-settlement' as WorkflowRunId;

describe('planApprovedFollowOf', () => {
  it('says the run goes on when the run carries itself, keyed by the run', () => {
    expect(planApprovedFollowOf({ sessionId: SESSION, runId: RUN, startedStepName: null })).toEqual(
      {
        title: 'Plan approved',
        message: 'The run goes on',
        label: 'Follow the run',
        startKey: RUN,
        target: {
          place: sessionPlace({
            sessionId: SESSION,
            lens: 'workflows',
            target: { kind: 'run', runId: RUN },
          }),
        },
      },
    );
  });

  it('names the step that started', () => {
    expect(
      planApprovedFollowOf({ sessionId: SESSION, runId: RUN, startedStepName: 'Implement' })
        .message,
    ).toBe('Implement started');
  });
});
