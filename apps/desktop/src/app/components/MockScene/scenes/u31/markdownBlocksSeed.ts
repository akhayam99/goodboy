import { brandId, type IsoDateTime, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import { sceneClock } from '../../sceneClock';
import { autoSceneOf, type AutoSceneData } from '../u24/autoSceneSeed';

const clock = sceneClock({ anchor: '2026-10-13T12:21:00.000Z' });

type AtParams = {
  readonly time: string;
};

const at = ({ time }: AtParams): IsoDateTime => clock.iso({ at: `2026-10-13T${time}.000Z` });

const RUN_ONE = brandId<ProviderRunId>({ value: 'mock-blocks-run-1' });

const GOAL = 'Why does the schema check reject PR #309, and what is a safe order to ship it?';

const OUTCOME = 'Blocked: the NOT NULL column needs a backfill first';

const ANSWER = [
  '## Why ledger-core rejects PR #309',
  'The migration in PR #309 adds a NOT NULL column to `ledger_entries` without a default. The schema check in ledger-core runs before every deploy, finds rows with no value and stops the release.',
  [
    '- The check is `verify-schema`, step 3 of the Harborline deploy.',
    '- About 1.2M rows in production have no `settled_at` yet.',
    '- payments-api reads the column on every refund, so a half deploy would fail refunds.',
  ].join('\n'),
  'A safe order splits the change in three steps:',
  [
    '```sql',
    'ALTER TABLE ledger_entries',
    '  ADD COLUMN settled_at timestamptz;',
    'UPDATE ledger_entries',
    '  SET settled_at = created_at WHERE id BETWEEN :first AND :last;',
    'ALTER TABLE ledger_entries',
    '  ALTER COLUMN settled_at SET NOT NULL;',
    '```',
  ].join('\n'),
  '### What each step costs',
  [
    '| Step | Lock | Time | Rows touched |',
    '| --- | --- | ---: | ---: |',
    '| Add the column | Brief | 40 ms | 0 |',
    '| Backfill in batches of 10k | None | 6 min | 1.2M |',
    '| Set NOT NULL | Full scan | 2 s | 1.2M |',
  ].join('\n'),
  'Run the backfill in batches of 10k so the lock stays short and `payments-api` keeps reading.',
  'I would ship the column and the backfill in PR #309, and the NOT NULL in a follow-up once the backfill has run. Want me to open that follow-up on `payments-api`?',
  '## Part 2: the follow-up',
  'The follow-up is one small PR. It waits for the backfill job to report zero rows left, then sets the constraint in a single statement.',
].join('\n\n');

const EVENTS: ReadonlyArray<TurnEvent> = [
  { kind: 'user_text', runId: RUN_ONE, text: GOAL, at: at({ time: '12:04:00' }) },
  {
    kind: 'assistant_text',
    runId: RUN_ONE,
    delta: `<<outcome>>${OUTCOME}<</outcome>>\n\n${ANSWER}`,
    at: at({ time: '12:04:30' }),
  },
];

export const markdownBlocksSceneOf = (): AutoSceneData => ({
  ...autoSceneOf({ state: 'done' }),
  events: EVENTS,
});
