import { describe, expect, it } from 'vitest';
import type { Agent, AgentSourceKind, AgentStatus } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { agentIdOf } from '../../__tests__/helpers/brandedIds';
import { sceneClock } from '../../app/components/MockScene/sceneClock';
import { SESSION_ID } from '../../app/components/MockScene/scenes/resolveSeed';
import { commentRunOf } from './commentRunOf';
import { noteThreadId } from './notes/noteThread';

const clock = sceneClock({ anchor: '2026-11-17T09:40:00.000Z' });

const HEADER_NOTE = noteThreadId({ noteId: 'note-ledger-header' });
const TOTALS_NOTE = noteThreadId({ noteId: 'note-ledger-totals' });
const LAYOUT_THREAD = 'PRRT_harborline_ledger_layout';
const IMPORT_THREAD = 'PRRT_harborline_import_order';

type RunParams = {
  readonly id: string;
  readonly ordinal: number;
  readonly threadIds: ReadonlyArray<string>;
  readonly status?: AgentStatus;
  readonly sourceKind?: AgentSourceKind;
  readonly isDeleted?: boolean;
};

const runOf = ({
  id,
  ordinal,
  threadIds,
  status = 'running',
  sourceKind = 'comment_run',
  isDeleted = false,
}: RunParams): Agent =>
  anAgent({
    id: agentIdOf({ value: id }),
    sessionId: SESSION_ID,
    ordinal,
    name: 'Move the ledger header into AppLayout',
    status,
    kind: 'auto',
    sourceKind,
    sourceThreadIds: threadIds,
    ...(threadIds[0] !== undefined && { sourceThreadId: threadIds[0] }),
    ...(isDeleted && { deletedAt: clock.iso({ at: '2026-11-17T09:00:00.000Z' }) }),
  });

describe('commentRunOf names the run that works on a thread', () => {
  it('points every comment of one run to that run, notes and host comments alike', () => {
    const run = runOf({
      id: 'run-ledger-header',
      ordinal: 0,
      threadIds: [HEADER_NOTE, LAYOUT_THREAD, TOTALS_NOTE],
    });

    expect(
      [HEADER_NOTE, LAYOUT_THREAD, TOTALS_NOTE].map((threadId) =>
        commentRunOf({ agents: [run], threadId }),
      ),
    ).toEqual([run.id, run.id, run.id]);
  });

  it('points each thread to its own run when several runs share the branch', () => {
    const header = runOf({ id: 'run-ledger-header', ordinal: 0, threadIds: [HEADER_NOTE] });
    const imports = runOf({ id: 'run-import-order', ordinal: 1, threadIds: [IMPORT_THREAD] });
    const agents = [header, imports];

    expect(commentRunOf({ agents, threadId: HEADER_NOTE })).toBe(header.id);
    expect(commentRunOf({ agents, threadId: IMPORT_THREAD })).toBe(imports.id);
    expect(commentRunOf({ agents, threadId: LAYOUT_THREAD })).toBeNull();
  });

  it('frees only the threads of a stopped run', () => {
    const stopped = runOf({
      id: 'run-ledger-header',
      ordinal: 0,
      threadIds: [HEADER_NOTE, LAYOUT_THREAD],
      status: 'stopped',
    });
    const working = runOf({ id: 'run-import-order', ordinal: 1, threadIds: [IMPORT_THREAD] });
    const agents = [stopped, working];

    expect(commentRunOf({ agents, threadId: HEADER_NOTE })).toBeNull();
    expect(commentRunOf({ agents, threadId: LAYOUT_THREAD })).toBeNull();
    expect(commentRunOf({ agents, threadId: IMPORT_THREAD })).toBe(working.id);
  });

  it('keeps a finished run on its threads until a newer run takes one', () => {
    const finished = runOf({
      id: 'run-ledger-header',
      ordinal: 0,
      threadIds: [HEADER_NOTE, LAYOUT_THREAD],
      status: 'completed',
    });
    const again = runOf({ id: 'run-ledger-header-2', ordinal: 3, threadIds: [LAYOUT_THREAD] });

    expect(commentRunOf({ agents: [finished], threadId: LAYOUT_THREAD })).toBe(finished.id);
    expect(commentRunOf({ agents: [again, finished], threadId: LAYOUT_THREAD })).toBe(again.id);
    expect(commentRunOf({ agents: [again, finished], threadId: HEADER_NOTE })).toBe(finished.id);
  });

  it('follows a comment added to a run after it started', () => {
    const before = runOf({ id: 'run-ledger-header', ordinal: 0, threadIds: [HEADER_NOTE] });
    const after = { ...before, sourceThreadIds: [HEADER_NOTE, TOTALS_NOTE] };

    expect(commentRunOf({ agents: [before], threadId: TOTALS_NOTE })).toBeNull();
    expect(commentRunOf({ agents: [after], threadId: TOTALS_NOTE })).toBe(before.id);
  });

  it('never reads a fix or a recheck on the same thread as a run', () => {
    const fix = runOf({
      id: 'fix-ledger-layout',
      ordinal: 0,
      threadIds: [LAYOUT_THREAD],
      sourceKind: 'review_comment',
    });
    const recheck = runOf({
      id: 'recheck-ledger-layout',
      ordinal: 1,
      threadIds: [LAYOUT_THREAD],
      sourceKind: 'comment_recheck',
    });

    expect(commentRunOf({ agents: [fix, recheck], threadId: LAYOUT_THREAD })).toBeNull();
  });

  it('drops a deleted run', () => {
    const deleted = runOf({
      id: 'run-ledger-header',
      ordinal: 0,
      threadIds: [HEADER_NOTE],
      isDeleted: true,
    });

    expect(commentRunOf({ agents: [deleted], threadId: HEADER_NOTE })).toBeNull();
  });
});
