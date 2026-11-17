import { describe, expect, it } from 'vitest';
import {
  brandId,
  type Agent,
  type AgentStatus,
  type DiffComment,
  type IsoDateTime,
  type MountId,
  type PrComment,
  type ProjectId,
  type ResolveThread,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { agentIdOf } from '../../__tests__/helpers/brandedIds';
import { SESSION_ID } from '../../app/components/MockScene/scenes/resolveSeed';
import { commentMountIdOf } from './commentMountIdOf';
import { commentRunPlacesOf } from './commentRunPlacesOf';
import { joinableCommentRunsOf } from './joinableCommentRunsOf';
import { noteThreadId } from './notes/noteThread';

const LEDGER_MOUNT = brandId<MountId>({ value: 'mount-ledger-layout' });
const EXPORT_MOUNT = brandId<MountId>({ value: 'mount-ledger-export' });
const PROJECT = brandId<ProjectId>({ value: 'project-payments-api' });
const AT = brandId<IsoDateTime>({ value: '2026-11-17T09:40:00.000Z' });
const HEADER_NOTE = noteThreadId({ noteId: 'note-ledger-header' });
const FILTERS_NOTE = noteThreadId({ noteId: 'note-ledger-filters' });
const IMPORT_THREAD = 'PRRT_harborline_import_order';

type LeadParams = {
  readonly id: string;
  readonly ordinal: number;
  readonly threadIds: ReadonlyArray<string>;
  readonly mountId?: MountId;
  readonly status?: AgentStatus;
  readonly isDone?: boolean;
};

const leadOf = ({
  id,
  ordinal,
  threadIds,
  mountId = LEDGER_MOUNT,
  status = 'running',
  isDone = false,
}: LeadParams): Agent =>
  anAgent({
    id: agentIdOf({ value: id }),
    sessionId: SESSION_ID,
    ordinal,
    name: id,
    status,
    kind: 'auto',
    sourceKind: 'comment_run',
    sourceThreadIds: threadIds,
    mountId,
    ...(isDone && { doneAt: AT }),
  });

type NoteParams = {
  readonly id: string;
  readonly branch: string;
};

const noteOf = ({ id, branch }: NoteParams): DiffComment => ({
  id,
  sessionId: SESSION_ID,
  filePath: 'src/routes/ledger/LedgerFilters.tsx',
  body: 'Same for the filters bar: it belongs to the layout slot.',
  status: 'open',
  createdAt: AT,
  anchor: { side: 'new', lineNumber: 9 },
  authorKind: 'user',
  projectId: PROJECT,
  branch,
});

const MOUNTS = [
  { id: LEDGER_MOUNT, projectId: PROJECT, branch: 'hl/ledger-layout', isAttached: true },
  { id: EXPORT_MOUNT, projectId: PROJECT, branch: 'hl/ledger-export', isAttached: true },
];

type ThreadParams = {
  readonly threadId: string;
  readonly isNote: boolean;
};

const threadOf = ({
  threadId,
  isNote,
}: ThreadParams): Pick<ResolveThread, 'threadId' | 'originKind' | 'diffCommentId'> => ({
  threadId,
  originKind: isNote ? 'diff_comment' : 'review_comment',
  diffCommentId: null,
});

describe('joinableCommentRunsOf offers the live runs of the comment branch', () => {
  it('offers the newest live run on the same branch first', () => {
    const older = leadOf({ id: 'older', ordinal: 0, threadIds: [HEADER_NOTE] });
    const newer = leadOf({ id: 'newer', ordinal: 1, threadIds: [IMPORT_THREAD] });
    const elsewhere = leadOf({
      id: 'export',
      ordinal: 2,
      threadIds: [],
      mountId: EXPORT_MOUNT,
    });

    expect(
      joinableCommentRunsOf({
        agents: [older, newer, elsewhere],
        threadId: FILTERS_NOTE,
        mountId: LEDGER_MOUNT,
      }).map((agent) => agent.id),
    ).toEqual([newer.id, older.id]);
  });

  it('offers nothing for a thread already in a run, a stopped or done run, or an unknown branch', () => {
    const working = leadOf({ id: 'working', ordinal: 0, threadIds: [HEADER_NOTE] });
    const stopped = leadOf({ id: 'stopped', ordinal: 1, threadIds: [], status: 'stopped' });
    const done = leadOf({ id: 'done', ordinal: 2, threadIds: [], isDone: true });

    expect(
      joinableCommentRunsOf({ agents: [working], threadId: HEADER_NOTE, mountId: LEDGER_MOUNT }),
    ).toEqual([]);
    expect(
      joinableCommentRunsOf({
        agents: [stopped, done],
        threadId: FILTERS_NOTE,
        mountId: LEDGER_MOUNT,
      }),
    ).toEqual([]);
    expect(
      joinableCommentRunsOf({ agents: [working], threadId: FILTERS_NOTE, mountId: null }),
    ).toEqual([]);
  });
});

describe('commentMountIdOf names the branch a comment sits on', () => {
  it('finds the mount of a note by its branch, and a host thread by its source', () => {
    const notes = [noteOf({ id: 'note-ledger-filters', branch: 'hl/ledger-export' })];

    expect(
      commentMountIdOf({
        thread: threadOf({ threadId: FILTERS_NOTE, isNote: true }),
        notes,
        mounts: MOUNTS,
        sourceMountId: LEDGER_MOUNT,
      }),
    ).toBe(EXPORT_MOUNT);
    expect(
      commentMountIdOf({
        thread: threadOf({ threadId: IMPORT_THREAD, isNote: false }),
        notes,
        mounts: MOUNTS,
        sourceMountId: LEDGER_MOUNT,
      }),
    ).toBe(LEDGER_MOUNT);
  });

  it('falls back to the one attached mount, and to none when several could hold the note', () => {
    const thread = threadOf({ threadId: HEADER_NOTE, isNote: true });
    const [ledger] = MOUNTS;

    expect(
      commentMountIdOf({
        thread,
        notes: [],
        mounts: ledger === undefined ? [] : [ledger],
        sourceMountId: null,
      }),
    ).toBe(LEDGER_MOUNT);
    expect(commentMountIdOf({ thread, notes: [], mounts: MOUNTS, sourceMountId: null })).toBeNull();
  });
});

describe('commentRunPlacesOf names where each comment of a run sits', () => {
  it('reads notes and host comments, and skips what is not loaded', () => {
    const comments: ReadonlyArray<PrComment> = [
      {
        id: 'c1',
        author: 'mira-s',
        authorAvatarUrl: null,
        body: 'Sort these imports.',
        createdAt: AT,
        url: 'https://github.com/harborline/payments-api/pull/412#discussion_r1',
        source: 'review',
        path: 'src/routes/ledger/index.ts',
        line: 3,
        threadId: IMPORT_THREAD,
      },
    ];

    expect(
      commentRunPlacesOf({
        threadIds: [FILTERS_NOTE, IMPORT_THREAD, HEADER_NOTE],
        notes: [noteOf({ id: 'note-ledger-filters', branch: 'hl/ledger-layout' })],
        comments,
      }),
    ).toEqual({ [FILTERS_NOTE]: 'LedgerFilters.tsx:9', [IMPORT_THREAD]: 'index.ts:3' });
  });
});
