// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  SessionEvent,
  SessionEventId,
  SessionEventKind,
  SessionEventPayload,
  SessionId,
  WorktreeStatus,
} from '@goodboy/types';
import type { HistoryStopReason } from '../../store/slices/history/types';
import { rebaseStopOf } from './rebaseStopOf';
import { rebaseJobOf } from './rebaseJob';
import { rebaseConflictOf } from './rebaseConflictOf';
import { aRebaseRun } from './testing/aRebaseRun';
import { brandedId } from './testing/brandedId';

const SESSION_ID = brandedId<SessionId>({ value: 'session-harborline' });
const MOUNT_ID = brandedId<MountId>({ value: 'mount-members' });
const OTHER_MOUNT_ID = brandedId<MountId>({ value: 'mount-profile' });
const STOPPED_AT = '2026-10-22T10:00:00.000Z';
const STOPPED_MS = Date.parse(STOPPED_AT);

type EventParams = {
  readonly id: string;
  readonly kind?: SessionEventKind;
  readonly at?: string;
  readonly payload?: SessionEventPayload;
};

const anEvent = ({
  id,
  kind = 'history_stopped',
  at = STOPPED_AT,
  payload = {},
}: EventParams): SessionEvent => ({
  id: brandedId<SessionEventId>({ value: id }),
  sessionId: SESSION_ID,
  kind,
  payload: {
    mountId: MOUNT_ID,
    branch: 'hl/feat-center-members-page',
    projectName: 'harbor-portal',
    origin: 'rebase',
    ...payload,
  },
  createdAt: brandedId<IsoDateTime>({ value: at }),
});

type StatusParams = {
  readonly head?: string;
  readonly isRebasing?: boolean;
  readonly unmerged?: number;
  readonly behind?: number;
};

const aStatus = ({
  head = 'b0a1c2d',
  isRebasing = false,
  unmerged = 0,
  behind = 6,
}: StatusParams = {}): WorktreeStatus => ({
  branch: 'hl/feat-center-members-page',
  head,
  headSubject: 'Center the members page',
  upstream: 'origin/hl/feat-center-members-page',
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  mainDistance: { kind: 'known', ahead: 4, behind },
  workingTree: {
    kind: 'known',
    staged: 0,
    unstaged: 0,
    untracked: 0,
    unmerged,
    changed: unmerged,
  },
  inProgress: isRebasing ? 'rebase' : null,
});

const BASE = {
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  settledStopIds: undefined,
  baseBranch: 'main',
};

const STOP_REASONS: ReadonlyArray<readonly [HistoryStopReason, string]> = [
  ['conflict', 'conflict'],
  ['hook', 'conflict'],
  ['origin-moved', 'origin-moved'],
  ['push-failed', 'push-failed'],
  ['dirty', 'dirty'],
  ['head-moved', 'head-moved'],
  ['blocked', 'blocked'],
  ['unverified', 'result-differs'],
  ['invalid', 'result-differs'],
  ['failed', 'failed'],
];

describe('rebaseStopOf', () => {
  it('has no stop without a run or a saved stop', () => {
    expect(rebaseStopOf({ ...BASE, run: null, events: [], read: null })).toBeNull();
  });

  it('uses the live run when the window still has it', () => {
    const run = aRebaseRun({ mountId: MOUNT_ID, phase: 'stopped' });
    const event = anEvent({ id: 'ev-1', payload: { reason: 'conflict' } });

    const stop = rebaseStopOf({ ...BASE, run, events: [event], read: null });

    expect(stop?.run).toBe(run);
    expect(stop?.isRebuilt).toBe(false);
  });

  it.each(STOP_REASONS)(
    'rebuilds a %s stop from the saved event and the job reads it as %s',
    (reason, state) => {
      const event = anEvent({
        id: 'ev-1',
        payload: {
          reason,
          title: 'The rebase stopped.',
          files: ['src/pages/members/MembersPage.tsx'],
          head: 'b0a1c2d',
        },
      });

      const stop = rebaseStopOf({ ...BASE, run: undefined, events: [event], read: null });

      expect(stop?.isRebuilt).toBe(true);
      expect(stop?.eventId).toBe(event.id);
      expect(stop?.run.stop?.reason).toBe(reason);
      expect(stop?.run.stop?.head).toBe('b0a1c2d');
      expect(stop?.run.updatedAt).toBe(STOPPED_MS);
      const job =
        stop === null
          ? null
          : rebaseJobOf({
              run: stop.run,
              projectName: 'harbor-portal',
              baseBranch: 'main',
              commitCount: null,
              dirtyCount: null,
            });
      expect(job?.state).toBe(state);
    },
  );

  it('gives a rebuilt conflict the files and base but no onto ref, so Auto reads it again', () => {
    const event = anEvent({
      id: 'ev-1',
      payload: {
        reason: 'conflict',
        files: ['src/pages/members/MembersPage.tsx', 'src/pages/members/members.css'],
        head: 'b0a1c2d',
      },
    });

    const stop = rebaseStopOf({ ...BASE, run: undefined, events: [event], read: null });

    expect(rebaseConflictOf({ run: stop?.run })).toEqual({
      files: ['src/pages/members/MembersPage.tsx', 'src/pages/members/members.css'],
      count: 2,
      isHook: false,
      baseBranch: 'main',
      ontoRef: null,
      head: 'b0a1c2d',
      autoAgentId: null,
      isHere: false,
    });
  });

  it('takes the latest open stop of this branch only', () => {
    const older = anEvent({
      id: 'ev-1',
      at: '2026-10-22T09:00:00.000Z',
      payload: { reason: 'failed' },
    });
    const newer = anEvent({ id: 'ev-2', payload: { reason: 'conflict' } });
    const other = anEvent({
      id: 'ev-3',
      at: '2026-10-22T11:00:00.000Z',
      payload: { reason: 'dirty', mountId: OTHER_MOUNT_ID },
    });

    const stop = rebaseStopOf({
      ...BASE,
      run: undefined,
      events: [older, newer, other],
      read: null,
    });

    expect(stop?.eventId).toBe(newer.id);
  });

  it('drops a stop a later history event replaced, a rewrite stop, and a settled one', () => {
    const stopped = anEvent({ id: 'ev-1', payload: { reason: 'conflict' } });
    const restored = anEvent({
      id: 'ev-2',
      kind: 'history_restored',
      at: '2026-10-22T10:05:00.000Z',
      payload: { reason: 'kept' },
    });
    const rewrite = anEvent({ id: 'ev-3', payload: { reason: 'conflict', origin: 'plan' } });

    expect(
      rebaseStopOf({ ...BASE, run: undefined, events: [stopped, restored], read: null }),
    ).toBeNull();
    expect(rebaseStopOf({ ...BASE, run: undefined, events: [rewrite], read: null })).toBeNull();
    expect(
      rebaseStopOf({
        ...BASE,
        settledStopIds: [stopped.id],
        run: undefined,
        events: [stopped],
        read: null,
      }),
    ).toBeNull();
  });

  it('drops a rebuilt conflict once a fresh git read shows the rebase finished', () => {
    const event = anEvent({ id: 'ev-1', payload: { reason: 'conflict', head: 'b0a1c2d' } });

    const stop = rebaseStopOf({
      ...BASE,
      run: undefined,
      events: [event],
      read: { status: aStatus({ head: 'f9e8d7c', behind: 0 }), readAt: STOPPED_MS + 1 },
    });

    expect(stop).toBeNull();
  });

  it('ignores a late git read requested before the stop, for an old head', () => {
    const event = anEvent({ id: 'ev-1', payload: { reason: 'conflict', head: 'b0a1c2d' } });

    const stop = rebaseStopOf({
      ...BASE,
      run: undefined,
      events: [event],
      read: { status: aStatus({ head: 'a1b2c3d', isRebasing: true }), readAt: STOPPED_MS - 1 },
    });

    expect(stop?.isRebuilt).toBe(true);
    expect(stop?.status).toBeNull();
  });

  it('keeps the fresh git read with the rebuilt stop', () => {
    const event = anEvent({ id: 'ev-1', payload: { reason: 'conflict', head: 'b0a1c2d' } });
    const status = aStatus({ isRebasing: true, unmerged: 2 });

    const stop = rebaseStopOf({
      ...BASE,
      run: undefined,
      events: [event],
      read: { status, readAt: STOPPED_MS + 1 },
    });

    expect(stop?.status).toBe(status);
  });

  it('reads an unknown saved reason as failed', () => {
    const event = anEvent({ id: 'ev-1', payload: { reason: 'something-new' } });

    const stop = rebaseStopOf({ ...BASE, run: undefined, events: [event], read: null });

    expect(stop?.run.stop?.reason).toBe('failed');
  });
});
