import type { OrchestratorHint, Session, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { HINT_NODE_SEED } from '../surfaces/hint-node/hintNodeSeed';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-30T15:12:00.000Z' });

type SeedParams = {
  readonly isReading: boolean;
};

const HINT_TEXTS = [
  'Also cover the refund webhook.',
  'Keep the retry cap per notify-relay endpoint.',
  'Log the final attempt count in ledger-core.',
  'Do not touch the checkout copy.',
  'Add a test for the 502 from payments-api.',
  'Name the cap in the config, not in code.',
  'Check the Harborline staging queue first.',
  'Skip the Northwind fixtures.',
  'Leave the dead letter table alone.',
  'Write the release note last.',
];

const IMAGE_EVERY = 3;
const FIRST_QUEUED_MINUTE = 30;

const imageIds = (HINT_NODE_SEED.run.orchestratorHints ?? []).flatMap(
  (hint) => hint.attachmentIds ?? [],
);

const queuedHints = (): ReadonlyArray<OrchestratorHint> =>
  HINT_TEXTS.map((text, index) => ({
    id: `mock-u34-hq-hint-${index}`,
    text,
    createdAt: clock.iso({
      at: `2026-10-30T11:${String(FIRST_QUEUED_MINUTE + index).padStart(2, '0')}:00.000Z`,
    }),
    ...(index % IMAGE_EVERY === 0 ? { attachmentIds: imageIds } : {}),
  }));

const readHint = (): OrchestratorHint | undefined => HINT_NODE_SEED.run.orchestratorHints?.[0];

const seedHintQueue = ({ isReading }: SeedParams): Session => {
  HINT_NODE_SEED.seed();
  const read = readHint();
  const queued = queuedHints();
  const run: WorkflowRun = {
    ...HINT_NODE_SEED.run,
    orchestratorHints: read === undefined ? queued : [read, ...queued],
  };
  const first = queued[0];
  const session: Session = { ...HINT_NODE_SEED.session, workflowRuns: [run] };
  useAppStore.setState({
    sessions: [session],
    orchestratorReadingHints: {
      [HINT_NODE_SEED.runId]: isReading && first !== undefined ? [first.id] : [],
    },
  });
  return session;
};

export const HINT_QUEUE_SEED = {
  hintCount: HINT_TEXTS.length,
  run: HINT_NODE_SEED.run,
  seed: seedHintQueue,
};
