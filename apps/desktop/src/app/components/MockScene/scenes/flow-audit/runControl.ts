import type { ProviderRunId, Session, TurnEvent } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import {
  AGENT_BACKFILL_ID,
  DYNAMIC_RUN_ID,
  FLOW_SESSION,
  FLOW_SESSION_ID,
  SESSIONS,
} from './fixtures';
import { seedWorkflowRun } from './seeds';

const clock = sceneClock({ anchor: '2026-09-16T11:20:00.000Z' });

const BACKFILL_RUN = 'mock-flow-provider-run-backfill' as ProviderRunId;

type EventsParams = {
  readonly lastAt: string;
};

const backfillEvents = ({ lastAt }: EventsParams): ReadonlyArray<TurnEvent> => [
  {
    kind: 'assistant_text',
    runId: BACKFILL_RUN,
    delta: 'Adding an attempts count to every delivery the relay retries.',
    at: clock.iso({ at: '2026-09-16T10:35:00.000Z' }),
  },
  {
    kind: 'tool_call_start',
    runId: BACKFILL_RUN,
    toolUseId: 'mock-flow-tool-backoff',
    toolName: 'read_file',
    input: { file_path: 'src/retry/backoff.ts' },
    at: clock.iso({ at: lastAt }),
  },
  {
    kind: 'tool_call_end',
    runId: BACKFILL_RUN,
    toolUseId: 'mock-flow-tool-backoff',
    output: 'ok',
    isError: false,
    at: clock.iso({ at: lastAt }),
  },
];

export const seedRecentBackfillOutput = () => {
  useAppStore.setState({
    transcripts: { [AGENT_BACKFILL_ID]: backfillEvents({ lastAt: '2026-09-16T11:18:00.000Z' }) },
  });
};

export const seedWorkflowRunQuiet = () => {
  seedWorkflowRun();
  useAppStore.setState({
    transcripts: { [AGENT_BACKFILL_ID]: backfillEvents({ lastAt: '2026-09-16T11:00:00.000Z' }) },
  });
};

const PAUSE_MESSAGE =
  'Paused by you. The step in flight finishes its turn and nothing new starts until you resume.';

export const PAUSED_SESSION: Session = {
  ...FLOW_SESSION,
  workflowRuns: FLOW_SESSION.workflowRuns.map((run) =>
    run.id === DYNAMIC_RUN_ID
      ? { ...run, orchestrationStop: { kind: 'paused', message: PAUSE_MESSAGE } }
      : run,
  ),
};

export const seedWorkflowRunPaused = () => {
  seedWorkflowRun();
  seedRecentBackfillOutput();
  useAppStore.setState({
    sessions: SESSIONS.map((session) =>
      session.id === FLOW_SESSION_ID ? PAUSED_SESSION : session,
    ),
  });
};
