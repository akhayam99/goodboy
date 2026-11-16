import {
  brandId,
  type SessionId,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { BoardScene, seedBoardScene } from '../BoardScene';

const WAITING_SESSION = brandId<SessionId>({ value: 'mock-board-session-notify-backoff' });

const WORKFLOW_ID = brandId<WorkflowId>({ value: 'mock-board-workflow-notify-backoff' });

const HELD = { kind: 'plan-approval', message: 'The plan is ready. Approve it to go on.' } as const;

type RunParams = {
  readonly index: number;
  readonly title: string;
};

const heldRunOf = ({ index, title }: RunParams): WorkflowRun => ({
  id: brandId<WorkflowRunId>({ value: `mock-board-run-notify-backoff-${index}` }),
  workflowId: WORKFLOW_ID,
  ordinal: index,
  currentStep: 1,
  autoRun: true,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  title,
  orchestrationStop: HELD,
});

type SeedParams = {
  readonly titles: ReadonlyArray<string>;
};

const seedWaitingRuns = ({ titles }: SeedParams): void => {
  seedBoardScene();
  useAppStore.setState((state) => ({
    sessions: state.sessions.map((session) =>
      session.id === WAITING_SESSION
        ? { ...session, workflowRuns: titles.map((title, index) => heldRunOf({ index, title })) }
        : session,
    ),
  }));
};

const ONE_RUN = ['Hold payouts behind a merchant notice'];

const TWO_RUNS = [...ONE_RUN, 'Rotate the notify-relay signing key'];

const seedOne = (): void => seedWaitingRuns({ titles: ONE_RUN });

const seedTwo = (): void => seedWaitingRuns({ titles: TWO_RUNS });

export const U44_BOARD_NEEDS_YOU_SCENES = {
  'board-needs-you-run': () => <BoardScene seed={seedOne} />,
  'board-needs-you-runs': () => <BoardScene seed={seedTwo} />,
};
