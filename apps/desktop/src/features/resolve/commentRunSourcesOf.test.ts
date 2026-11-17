import { describe, expect, it } from 'vitest';
import type { Agent, AgentSourceKind, ResolveStage } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { agentIdOf } from '../../__tests__/helpers/brandedIds';
import { SESSION_ID } from '../../app/components/MockScene/scenes/resolveSeed';
import { COMMENT_RUN_COPY } from './commentRunCopy';
import { commentRunSourcesOf } from './commentRunSourcesOf';
import { noteThreadId } from './notes/noteThread';
import type { ReviewCommentState } from './reviewCommentState';
import type { RowFix } from './rowFix';

const HEADER_NOTE = noteThreadId({ noteId: 'note-ledger-header' });
const FILTERS_NOTE = noteThreadId({ noteId: 'note-ledger-filters' });
const TOTALS_THREAD = 'PRRT_harborline_ledger_totals';
const EXPORT_THREAD = 'PRRT_harborline_ledger_export';
const IMPORT_THREAD = 'PRRT_harborline_import_order';
const SUMMARY_THREAD = 'PRRT_harborline_summary';

const PAGE = 'src/routes/ledger/LedgerPage.tsx';
const FILTERS_PATH = 'src/routes/ledger/LedgerFilters.tsx';
const EXPORT_PATH = 'src/routes/ledger/LedgerExport.tsx';

type EntryParams = {
  readonly threadId: string;
  readonly path: string | null;
  readonly state?: ReviewCommentState;
  readonly stage?: ResolveStage;
  readonly fix?: RowFix | null;
};

const entryOf = ({ threadId, path, state = 'new', stage = 'new', fix = null }: EntryParams) => ({
  threadId,
  state,
  fix,
  row: { reviewerNote: { path }, thread: { stage } },
});

type RunParams = {
  readonly id: string;
  readonly threadIds: ReadonlyArray<string>;
  readonly sourceKind?: AgentSourceKind;
};

const runOf = ({ id, threadIds, sourceKind = 'comment_run' }: RunParams): Agent =>
  anAgent({
    id: agentIdOf({ value: id }),
    sessionId: SESSION_ID,
    ordinal: 1,
    status: 'running',
    kind: 'auto',
    sourceKind,
    sourceThreadIds: threadIds,
  });

type IdsParams = {
  readonly entries: ReadonlyArray<{ readonly threadId: string }>;
};

const idsOf = ({ entries }: IdsParams): ReadonlyArray<string> =>
  entries.map((entry) => entry.threadId);

const HEADER = entryOf({ threadId: HEADER_NOTE, path: PAGE });
const FILTERS = entryOf({ threadId: FILTERS_NOTE, path: FILTERS_PATH });
const TOTALS = entryOf({ threadId: TOTALS_THREAD, path: PAGE });
const EXPORT = entryOf({ threadId: EXPORT_THREAD, path: EXPORT_PATH });
const IMPORT = entryOf({ threadId: IMPORT_THREAD, path: 'src/import/parseRows.ts' });

describe('commentRunSourcesOf', () => {
  it('offers the open comments of the same folder, same file first, at most three, never picked', () => {
    const summary = entryOf({ threadId: SUMMARY_THREAD, path: 'src/routes/ledger/summary.ts' });
    const sources = commentRunSourcesOf({
      entries: [HEADER, FILTERS, EXPORT, IMPORT, summary, TOTALS],
      agents: [],
      threadId: HEADER_NOTE,
      extraThreadIds: [],
    });
    expect(idsOf({ entries: sources.picked })).toEqual([HEADER_NOTE]);
    expect(idsOf({ entries: sources.candidates })).toEqual([
      TOTALS_THREAD,
      FILTERS_NOTE,
      EXPORT_THREAD,
    ]);
    expect(sources.blocked).toBeNull();
  });

  it('picks the extras in order, deduped, and drops them from the offer, notes and host comments mixed', () => {
    const sources = commentRunSourcesOf({
      entries: [HEADER, FILTERS, TOTALS, EXPORT],
      agents: [],
      threadId: HEADER_NOTE,
      extraThreadIds: [TOTALS_THREAD, FILTERS_NOTE, TOTALS_THREAD],
    });
    expect(idsOf({ entries: sources.picked })).toEqual([HEADER_NOTE, TOTALS_THREAD, FILTERS_NOTE]);
    expect(idsOf({ entries: sources.candidates })).toEqual([EXPORT_THREAD]);
  });

  it('never offers or keeps a comment already in a run or being fixed', () => {
    const sources = commentRunSourcesOf({
      entries: [
        HEADER,
        FILTERS,
        entryOf({ threadId: TOTALS_THREAD, path: PAGE, state: 'drafting' }),
        entryOf({ threadId: EXPORT_THREAD, path: EXPORT_PATH, fix: { kind: 'fixing' } }),
      ],
      agents: [runOf({ id: 'run-filters', threadIds: [FILTERS_NOTE] })],
      threadId: HEADER_NOTE,
      extraThreadIds: [FILTERS_NOTE, TOTALS_THREAD],
    });
    expect(idsOf({ entries: sources.picked })).toEqual([HEADER_NOTE]);
    expect(sources.candidates).toEqual([]);
  });

  it('reads a fix agent on a thread as a fix, not as a run', () => {
    const sources = commentRunSourcesOf({
      entries: [HEADER, FILTERS],
      agents: [
        runOf({ id: 'fix-filters', threadIds: [FILTERS_NOTE], sourceKind: 'review_comment' }),
      ],
      threadId: HEADER_NOTE,
      extraThreadIds: [],
    });
    expect(idsOf({ entries: sources.candidates })).toEqual([FILTERS_NOTE]);
  });

  it('skips settled comments and comments with work already drafted', () => {
    const sources = commentRunSourcesOf({
      entries: [
        HEADER,
        entryOf({ threadId: FILTERS_NOTE, path: FILTERS_PATH, stage: 'resolved' }),
        entryOf({ threadId: TOTALS_THREAD, path: PAGE, state: 'ready' }),
        EXPORT,
      ],
      agents: [],
      threadId: HEADER_NOTE,
      extraThreadIds: [],
    });
    expect(idsOf({ entries: sources.candidates })).toEqual([EXPORT_THREAD]);
  });

  it('blocks a start for a comment already in a run or being fixed', () => {
    expect(
      commentRunSourcesOf({
        entries: [HEADER],
        agents: [runOf({ id: 'run-header', threadIds: [HEADER_NOTE] })],
        threadId: HEADER_NOTE,
        extraThreadIds: [],
      }).blocked,
    ).toBe(COMMENT_RUN_COPY.inRun);
    expect(
      commentRunSourcesOf({
        entries: [entryOf({ threadId: HEADER_NOTE, path: PAGE, state: 'drafting' })],
        agents: [],
        threadId: HEADER_NOTE,
        extraThreadIds: [],
      }).blocked,
    ).toBe(COMMENT_RUN_COPY.fixing);
  });

  it('offers nothing for a comment with no file, and nothing at all for a thread that is gone', () => {
    expect(
      commentRunSourcesOf({
        entries: [entryOf({ threadId: SUMMARY_THREAD, path: null }), FILTERS],
        agents: [],
        threadId: SUMMARY_THREAD,
        extraThreadIds: [],
      }).candidates,
    ).toEqual([]);
    expect(
      commentRunSourcesOf({
        entries: [FILTERS],
        agents: [],
        threadId: HEADER_NOTE,
        extraThreadIds: [],
      }),
    ).toEqual({ blocked: null, picked: [], candidates: [] });
  });
});
