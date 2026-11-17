// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ResolveStage } from '@goodboy/types';
import type { ResolveQueueRow } from './buildResolveQueueRows';
import type { ResolveWord } from './commentProjection';
import {
  fixableThreadIdsOf,
  reviewTallyOf,
  reviewTallyOfWords,
  reviewTallyParts,
} from './reviewTally';
import { queueRowAt } from './testing/queueRow';
import { commentsCountOf } from './commentsCountOf';

const SOURCE_ROOT = join(__dirname, '..', '..');

const NO_RUNS: ReadonlySet<string> = new Set();

const BROAD_BODY =
  'Follow the payouts route as the model: AppLayout owns the header. Write new components for this.';

type NoteRowParams = {
  readonly threadId: string;
  readonly body: string;
};

const noteRowAt = ({ threadId, body }: NoteRowParams): ResolveQueueRow => ({
  ...queueRowAt({ stage: 'new', threadId }),
  reviewerNote: {
    source: 'github',
    body,
    author: 'mira-s',
    createdAtMs: 1,
    location: null,
    path: 'src/routes/ledger/LedgerPage.tsx',
    line: 24,
  },
});

describe('reviewTallyOfWords', () => {
  const words: ReadonlyArray<ResolveWord> = [
    'question',
    'to_review',
    'to_review',
    'push_failed',
    'couldnt_fix',
    'working',
    'working',
    'ready',
    'ready',
    'done',
    'left_open',
    'open',
  ];

  it('counts every word once and sums the ones that need you', () => {
    expect(reviewTallyOfWords({ words })).toEqual({
      needsYou: 6,
      question: 1,
      toReview: 2,
      pushFailed: 1,
      couldntFix: 1,
      working: 2,
      readyToPush: 2,
      done: 1,
      leftOpen: 1,
      open: 1,
      fixable: 2,
    });
  });

  it('reads 4 need you, 2 working and 2 ready to push as one phrase', () => {
    expect(
      reviewTallyParts({
        tally: reviewTallyOfWords({
          words: [
            'question',
            'to_review',
            'to_review',
            'push_failed',
            'working',
            'working',
            'ready',
            'ready',
          ],
        }),
      }),
    ).toEqual(['4 need you', '2 working', '2 ready to push']);
    expect(reviewTallyParts({ tally: reviewTallyOfWords({ words: ['done'] }) })).toEqual([]);
  });
});

describe('reviewTallyOf', () => {
  const rowsOf = (stages: ReadonlyArray<ResolveStage>) =>
    stages.map((stage, index) => queueRowAt({ stage, threadId: `PRRT_${index}` }));

  it('derives the words from the rows, one count per surface', () => {
    const rows = [
      ...rowsOf(['asking', 'proposed', 'proposed', 'working', 'approved', 'parked', 'new']),
      queueRowAt({ stage: 'failed', failedStep: 'push', threadId: 'PRRT_push' }),
      queueRowAt({ stage: 'failed', failedStep: 'run', threadId: 'PRRT_run' }),
      queueRowAt({ stage: 'resolved', deliveredAt: 5, threadId: 'PRRT_done' }),
    ];

    expect(reviewTallyOf({ rows, inRunThreadIds: NO_RUNS })).toEqual({
      needsYou: 6,
      question: 1,
      toReview: 2,
      pushFailed: 1,
      couldntFix: 1,
      working: 1,
      readyToPush: 1,
      done: 1,
      leftOpen: 1,
      open: 1,
      fixable: 2,
    });
  });

  it('counts the proposals that wait for your Accept as the Accept N of the group', () => {
    const rows = rowsOf(['proposed', 'proposed', 'proposed', 'asking']);

    expect(reviewTallyOf({ rows, inRunThreadIds: NO_RUNS }).toReview).toBe(3);
  });
});

describe('commentsCountOf', () => {
  it('counts the same comments as the tally, so the merge label and the Comments tab agree', () => {
    const rows = [
      queueRowAt({ stage: 'asking', threadId: 'PRRT_asking' }),
      queueRowAt({ stage: 'proposed', threadId: 'PRRT_proposed' }),
      queueRowAt({ stage: 'proposed', threadId: 'PRRT_proposed_2' }),
      queueRowAt({ stage: 'failed', failedStep: 'push', threadId: 'PRRT_push' }),
      queueRowAt({ stage: 'failed', failedStep: 'run', threadId: 'PRRT_run' }),
      queueRowAt({ stage: 'working', threadId: 'PRRT_working' }),
      queueRowAt({ stage: 'new', threadId: 'PRRT_new' }),
      queueRowAt({ stage: 'resolved', deliveredAt: 5, threadId: 'PRRT_done' }),
    ];

    const count = commentsCountOf({ threads: rows.map((row) => row.thread) });
    const tally = reviewTallyOf({ rows, inRunThreadIds: NO_RUNS });

    expect(count.needsYou).toBe(6);
    expect(count.needsYou).toBe(tally.needsYou);
    expect(count.fixable).toBe(tally.fixable);
    expect(count.unresolved).toBe(7);
  });

  it('counts a thread left open on the host as unresolved', () => {
    const rows = [
      queueRowAt({ stage: 'parked', threadId: 'PRRT_parked' }),
      queueRowAt({ stage: 'resolved', deliveredAt: 5, threadId: 'PRRT_done' }),
    ];

    expect(commentsCountOf({ threads: rows.map((row) => row.thread) }).unresolved).toBe(1);
  });
});

describe('fixableThreadIdsOf', () => {
  it('lists the open and the couldnt-fix comments, the same ones the tally counts as fixable', () => {
    const rows = [
      queueRowAt({ stage: 'new', threadId: 'PRRT_open' }),
      queueRowAt({ stage: 'failed', failedStep: 'run', threadId: 'PRRT_run' }),
      queueRowAt({ stage: 'failed', failedStep: 'push', threadId: 'PRRT_push' }),
      queueRowAt({ stage: 'working', threadId: 'PRRT_working' }),
      queueRowAt({ stage: 'asking', threadId: 'PRRT_asking' }),
    ];

    const params = { rows, inRunThreadIds: NO_RUNS };
    expect(fixableThreadIdsOf(params)).toEqual(['PRRT_open', 'PRRT_run']);
    expect(fixableThreadIdsOf(params)).toHaveLength(reviewTallyOf(params).fixable);
  });

  it('leaves out a comment that suggests a run and a comment already in a run', () => {
    const rows = [
      noteRowAt({ threadId: 'PRRT_typo', body: 'Typo: "recieved" in the empty state copy.' }),
      noteRowAt({ threadId: 'PRRT_layout', body: BROAD_BODY }),
      noteRowAt({ threadId: 'PRRT_import', body: 'Move this import into utils/format.ts.' }),
      noteRowAt({ threadId: 'PRRT_taken', body: 'Rename the totals row.' }),
    ];
    const params = { rows, inRunThreadIds: new Set(['PRRT_taken']) };

    expect(fixableThreadIdsOf(params)).toEqual(['PRRT_typo', 'PRRT_import']);
    expect(reviewTallyOf(params).fixable).toBe(2);
  });
});

const SURFACES = [
  'features/resolve/components/ReviewFlow/ReviewList.tsx',
  'features/resolve/components/ReviewFlow/FixRunCount.tsx',
  'features/resolve/commentWorkOf.ts',
  'features/resolve/commentTabLiveOf.ts',
  'features/resolve/components/ReviewFlow/PushBanner.tsx',
  'features/resolve/components/ReviewFlow/index.tsx',
  'features/resolve/fixRun.ts',
  'features/actions/kinds/review.ts',
  'features/session/hooks/usePageCountFacts/index.ts',
  'features/session/timeline/resolveActivity.ts',
  'features/suggestions/useSessionSuggestions/index.ts',
  'features/suggestions/useSuggestionActions/index.ts',
  'features/workspace/components/StageBoard/StageBoardCard/useDynamicActions/index.ts',
];

describe('one selector for every count of comments', () => {
  it.each(SURFACES)('%s does not count comments by itself', (file) => {
    const source = readFileSync(join(SOURCE_ROOT, file), 'utf8');

    expect(source).not.toMatch(/resolveTallyOf|resolveTallyParts|conversationsWaiting/);
    expect(source).not.toMatch(/rows\.filter\([^)]*(status|stage|state)/);
    expect(source).not.toMatch(/entries\.filter\([^)]*(isAcceptable|state ===)[^)]*\)\.length/);
  });
});
