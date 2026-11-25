// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type WorkflowRunId } from '@goodboy/types';
import { anAgent, aSession, aWorkflowRun } from '@goodboy/types/testing';
import {
  aPlanRow,
  aView,
  FIXTURE_ROOT,
  FIXTURE_SESSION,
} from '../../../auto/testing/autoViewFixtures';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { waitingRunOf, type WaitingRunState } from './waitingRunOf';

const ROOT = anAgent({ id: FIXTURE_ROOT, sessionId: FIXTURE_SESSION, kind: 'auto' });

type StateParams = {
  readonly views: ReadonlyArray<AutoTreeView>;
};

const stateOf = ({ views }: StateParams): WaitingRunState => ({
  agentTurnState: {},
  autoTreeViews: { [FIXTURE_SESSION]: views },
  autoClockAt: 0,
  sessionPhaseRuns: { [FIXTURE_SESSION]: [ROOT] },
  transcripts: {},
  settings: {},
});

const ASK = 'Stop retried webhooks posting a second credit';

describe('waitingRunOf', () => {
  it('names the Lead run whose plan waits and offers Review plan', () => {
    const view = aView({ phase: 'waiting', artifacts: [aPlanRow()], rootAsk: ASK });

    expect(
      waitingRunOf({
        state: stateOf({ views: [view] }),
        session: aSession({ id: FIXTURE_SESSION }),
        reason: 'auto-needs-you',
      }),
    ).toEqual({ title: ASK, words: 'Needs approval', verb: 'Review plan', more: 0 });
  });

  it('names a held Lead run and offers its switch', () => {
    const view = {
      ...aView({ phase: 'done', rootAsk: ASK }),
      hold: { reason: 'Not a bug', suggestion: 'Ship a feature', suggestionId: 'workflow-feature' },
    };

    expect(
      waitingRunOf({
        state: stateOf({ views: [view] }),
        session: aSession({ id: FIXTURE_SESSION }),
        reason: 'auto-needs-you',
      }),
    ).toEqual({
      title: ASK,
      words: 'Stopped on a check',
      verb: 'Switch to Ship a feature',
      more: 0,
    });
  });

  it('names a held Lead run with no suggestion and opens the Lead', () => {
    const view = {
      ...aView({ phase: 'done', rootAsk: ASK }),
      hold: { reason: 'Not a bug', suggestion: null, suggestionId: null },
    };

    expect(
      waitingRunOf({
        state: stateOf({ views: [view] }),
        session: aSession({ id: FIXTURE_SESSION }),
        reason: 'auto-needs-you',
      })?.verb,
    ).toBe('Open the Lead');
  });

  it('names no run for a reason that is not about a run', () => {
    const view = aView({ phase: 'waiting', artifacts: [aPlanRow()], rootAsk: ASK });

    expect(
      waitingRunOf({
        state: stateOf({ views: [view] }),
        session: aSession({ id: FIXTURE_SESSION }),
        reason: 'ci-failed',
      }),
    ).toBeNull();
  });

  it('names no run when the Lead behind the reason is gone', () => {
    expect(
      waitingRunOf({
        state: stateOf({ views: [] }),
        session: aSession({ id: FIXTURE_SESSION }),
        reason: 'auto-needs-you',
      }),
    ).toBeNull();
  });

  it('names the first held run by its title and counts the others', () => {
    const held = { kind: 'plan-approval', message: 'The plan needs approval' } as const;
    const session = aSession({
      id: FIXTURE_SESSION,
      workflowRuns: [
        aWorkflowRun({
          id: brandId<WorkflowRunId>({ value: 'run-relay' }),
          title: 'Rotate the relay key',
          orchestrationStop: held,
        }),
        aWorkflowRun({
          id: brandId<WorkflowRunId>({ value: 'run-ledger' }),
          title: 'Batch the ledger export',
          orchestrationStop: held,
        }),
      ],
    });

    expect(
      waitingRunOf({ state: stateOf({ views: [] }), session, reason: 'plan-approval' }),
    ).toEqual({
      title: 'Rotate the relay key',
      words: 'Needs approval',
      verb: 'Review plan',
      more: 1,
    });
  });
});
