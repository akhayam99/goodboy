// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ResolveStage } from '@goodboy/types';
import type { ResolveWord } from './commentProjection';
import {
  fixableThreadIdsOf,
  reviewNeedsYouOfThreads,
  reviewTallyOf,
  reviewTallyOfWords,
  reviewTallyParts,
} from './reviewTally';
import { queueRowAt } from './testing/queueRow';

const SOURCE_ROOT = join(__dirname, '..', '..');

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
      needsYou: 5,
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

    expect(reviewTallyOf({ rows })).toEqual({
      needsYou: 5,
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

    expect(reviewTallyOf({ rows }).toReview).toBe(3);
  });
});

describe('reviewNeedsYouOfThreads', () => {
  it('counts the same comments as the tally, so the merge caveat and the Comments tab agree', () => {
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

    const count = reviewNeedsYouOfThreads({ threads: rows.map((row) => row.thread) });

    expect(count).toBe(5);
    expect(count).toBe(reviewTallyOf({ rows }).needsYou);
  });

  it('leaves the notes out, they never sit in the pull request tally', () => {
    const note = queueRowAt({ stage: 'asking', originKind: 'diff_comment' });

    expect(reviewNeedsYouOfThreads({ threads: [note.thread] })).toBe(0);
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

    expect(fixableThreadIdsOf({ rows })).toEqual(['PRRT_open', 'PRRT_run']);
    expect(fixableThreadIdsOf({ rows })).toHaveLength(reviewTallyOf({ rows }).fixable);
  });
});

const SURFACES = [
  'features/resolve/components/ReviewFlow/ReviewList.tsx',
  'features/resolve/components/ReviewFlow/ResolveRunStatus.tsx',
  'features/resolve/components/ReviewFlow/PushBanner.tsx',
  'features/resolve/components/ReviewFlow/index.tsx',
  'features/resolve/fixRun.ts',
  'features/actions/kinds/review.ts',
  'features/session/hooks/usePageSummaries/index.ts',
  'features/session/timeline/resolveActivity.ts',
  'features/suggestions/useSessionSuggestions/index.ts',
  'features/suggestions/useSuggestionActions/index.ts',
  'features/workspace/components/StageBoard/StageBoardCard/useDynamicActions/index.ts',
  'features/session/components/SessionWorkspace/parts/TimelinePane/NeedsYouBlock.tsx',
];

describe('one selector for every count of comments', () => {
  it.each(SURFACES)('%s does not count comments by itself', (file) => {
    const source = readFileSync(join(SOURCE_ROOT, file), 'utf8');

    expect(source).not.toMatch(/resolveTallyOf|resolveTallyParts|conversationsWaiting/);
    expect(source).not.toMatch(/rows\.filter\([^)]*(status|stage|state)/);
    expect(source).not.toMatch(/entries\.filter\([^)]*(isAcceptable|state ===)[^)]*\)\.length/);
  });
});
