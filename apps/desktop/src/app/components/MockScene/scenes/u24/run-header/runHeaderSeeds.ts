import type { Session, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { sceneClock } from '../../../sceneClock';
import { DYNAMIC_RUN_ID, FLOW_SESSION, FLOW_SESSION_ID, SESSIONS } from '../../flow-audit/fixtures';
import { seedWorkflowRunPlanHoldDynamic } from '../../flow-audit/planHoldRun';
import { seedRecentBackfillOutput, seedWorkflowRunPaused } from '../../flow-audit/runControl';
import { seedWorkflowRun } from '../../flow-audit/seeds';

const clock = sceneClock({ anchor: '2026-09-16T11:20:00.000Z' });

type OverrideParams = {
  readonly override: Partial<WorkflowRun>;
};

const sessionWithRun = ({ override }: OverrideParams): Session => ({
  ...FLOW_SESSION,
  workflowRuns: FLOW_SESSION.workflowRuns.map((run) =>
    run.id === DYNAMIC_RUN_ID ? { ...run, ...override } : run,
  ),
});

export const FAILED_SESSION: Session = sessionWithRun({
  override: {
    orchestrationStop: {
      kind: 'failure',
      message: 'usage limit reached (anthropic/haiku-4.5)',
    },
  },
});

export const ARCHIVED_SESSION: Session = sessionWithRun({
  override: { discardedAt: clock.iso({ at: '2026-09-16T10:50:00.000Z' }) },
});

export const seedRunHeaderHeld = (): void => {
  seedWorkflowRunPlanHoldDynamic();
  useAppStore.setState({ selectedAgentId: {} });
};

export const seedRunHeaderPaused = (): void => {
  seedWorkflowRunPaused();
};

type SessionParams = {
  readonly session: Session;
};

const seedWithSession = ({ session }: SessionParams): void => {
  seedWorkflowRun();
  seedRecentBackfillOutput();
  useAppStore.setState({
    sessions: SESSIONS.map((candidate) => (candidate.id === FLOW_SESSION_ID ? session : candidate)),
    agentTurnState: {},
  });
};

export const seedRunHeaderFailed = (): void => seedWithSession({ session: FAILED_SESSION });

export const seedRunHeaderArchived = (): void => seedWithSession({ session: ARCHIVED_SESSION });
