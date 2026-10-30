import { brandId, type IsoDateTime, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import { sceneClock } from '../../sceneClock';
import { autoSceneOf, type AutoSceneData } from '../u24/autoSceneSeed';

const clock = sceneClock({ anchor: '2026-10-13T12:21:00.000Z' });

type AtParams = {
  readonly time: string;
};

const at = ({ time }: AtParams): IsoDateTime => clock.iso({ at: `2026-10-13T${time}.000Z` });

const RUN_ONE = brandId<ProviderRunId>({ value: 'mock-reading-run-1' });
const RUN_TWO = brandId<ProviderRunId>({ value: 'mock-reading-run-2' });
const RUN_THREE = brandId<ProviderRunId>({ value: 'mock-reading-run-3' });

const GOAL =
  'Why does the ledger retry post a second credit? Fix it and add a test for the retry path.';

type OutcomeParams = {
  readonly line: string;
  readonly body: string;
};

const outcomeOf = ({ line, body }: OutcomeParams): string =>
  `<<outcome>>${line}<</outcome>>\n\n${body}`;

const FIRST = outcomeOf({
  line: 'Planning first, because the change touches ledger code',
  body: [
    'This changes retry and ledger code, so I will not do it myself. A Planner goes first on Opus 5.5 because the change touches idempotency in two packages. Nothing is written until you approve its plan.',
    'The Planner finished with a 3 part plan. Approve it and I start the Implementer and the Tester. Ask for changes and the Planner revises it first.',
  ].join('\n\n'),
});

const SECOND = outcomeOf({
  line: 'Plan v1 approved, the Implementer is starting',
  body: 'The Implementer starts now on Sonnet 5.5, since the plan is mechanical. The Tester is queued behind it: only one agent writes to `payments-api` at a time.',
});

const FINAL = outcomeOf({
  line: 'Fixed: one credit per retry',
  body: [
    'The retry loop built a new idempotency key on every attempt, so a credit that timed out after the ledger wrote it could post twice. The key is now built once per credit, before the loop, and `applyCredit` returns the first result for a key it has seen.',
    '## What changed',
    '- `postCredit` builds the key once, before the loop, from the credit id and the attempt window.',
    '- `applyCredit` looks the key up first and returns the stored result when it finds one.',
    '- `config.ts` keeps `MAX_RETRY_ATTEMPTS` in one place, so the loop and the test read the same number.',
    '## How I checked it',
    'I ran the retry test with a timeout on the first attempt. It posts one credit, not two. The 14 existing tests in `payments-api` still pass, and the three new ones cover the timed out attempt, a repeated key and the balance after two attempts.',
    'The Tester also ran the suite twice in a row to be sure the stored result does not leak between runs, and it did not.',
    '## What is left',
    'The Reviewer checks the diff against the plan next. Nothing is pushed yet: the push waits for your go, because the branch is shared with `notify-relay`.',
    'If you want the retry window to be configurable per credit kind, say so and I add it as a separate step, since it changes the public config of `ledger-core`.',
  ].join('\n\n'),
});

type ToolParams = {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
  readonly time: string;
  readonly run: ProviderRunId;
};

const toolOf = ({ id, name, input, time, run }: ToolParams): ReadonlyArray<TurnEvent> => [
  {
    kind: 'tool_call_start',
    runId: run,
    toolUseId: `mock-reading-tool-${id}`,
    toolName: name,
    input,
    at: at({ time }),
  },
  {
    kind: 'tool_call_end',
    runId: run,
    toolUseId: `mock-reading-tool-${id}`,
    output: 'ok',
    isError: false,
    at: at({ time }),
  },
];

const FIRST_READ_SECOND = 10;

type RunParams = {
  readonly run: ProviderRunId;
};

const reads = ({ run }: RunParams) =>
  ['postCredit.ts', 'applyCredit.ts', 'config.ts', 'retry.test.ts'].flatMap((file, index) =>
    toolOf({
      id: `read-${index}`,
      name: 'Read',
      input: { file_path: `payments-api/src/${file}` },
      time: `12:04:${FIRST_READ_SECOND + index}`,
      run,
    }),
  );

type EditParams = {
  readonly path: string;
  readonly time: string;
  readonly run: ProviderRunId;
};

const edit = ({ path, time, run }: EditParams): TurnEvent => ({
  kind: 'file_edit',
  runId: run,
  path,
  editType: 'modify',
  at: at({ time }),
});

const EVENTS: ReadonlyArray<TurnEvent> = [
  { kind: 'user_text', runId: RUN_ONE, text: GOAL, at: at({ time: '12:04:00' }) },
  ...reads({ run: RUN_ONE }),
  { kind: 'assistant_text', runId: RUN_ONE, delta: FIRST, at: at({ time: '12:04:30' }) },
  { kind: 'user_text', runId: RUN_TWO, text: 'Approved plan v1.', at: at({ time: '12:09:00' }) },
  ...toolOf({
    id: 'grep-key',
    name: 'Grep',
    input: { pattern: 'idempotencyKey' },
    time: '12:09:03',
    run: RUN_TWO,
  }),
  { kind: 'assistant_text', runId: RUN_TWO, delta: SECOND, at: at({ time: '12:09:05' }) },
  {
    kind: 'user_text',
    runId: RUN_THREE,
    text: 'Looks good. Go ahead and finish it.',
    at: at({ time: '12:14:00' }),
  },
  edit({ path: 'payments-api/src/postCredit.ts', time: '12:14:10', run: RUN_THREE }),
  edit({ path: 'payments-api/src/applyCredit.ts', time: '12:14:12', run: RUN_THREE }),
  edit({ path: 'payments-api/src/config.ts', time: '12:14:14', run: RUN_THREE }),
  ...toolOf({
    id: 'run-tests',
    name: 'Bash',
    input: { command: 'pnpm --filter payments-api test' },
    time: '12:14:30',
    run: RUN_THREE,
  }),
  { kind: 'assistant_text', runId: RUN_THREE, delta: FINAL, at: at({ time: '12:14:50' }) },
];

export const chatReadingSceneOf = (): AutoSceneData => ({
  ...autoSceneOf({ state: 'done' }),
  events: EVENTS,
});
