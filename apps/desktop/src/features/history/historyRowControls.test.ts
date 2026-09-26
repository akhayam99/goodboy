import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  SessionEvent,
  SessionEventId,
  SessionEventKind,
  SessionEventPayload,
  SessionId,
} from '@goodboy/types';
import { historyRowControls } from './historyRowControls';
import { sessionEventLabel } from '../session/timeline/sessionEventPresentation';
import {
  DEFAULT_ACTIVITY_FILTER,
  activityCategoryOf,
  filterTimelineEntries,
} from '../session/timeline/activityFilter';

const event = ({
  id,
  kind,
  at,
  payload,
}: {
  readonly id: string;
  readonly kind: SessionEventKind;
  readonly at: string;
  readonly payload: SessionEventPayload;
}): SessionEvent => ({
  id: id as SessionEventId,
  sessionId: 'session-ledger' as SessionId,
  kind,
  payload: { mountId: 'mount-ledger', branch: 'fix/ledger-postings', ...payload },
  createdAt: at as IsoDateTime,
});

const text = ({ value }: { readonly value: SessionEvent }): string =>
  sessionEventLabel({ event: value })
    .map((segment) => segment.text)
    .join('');

describe('history activity rows', () => {
  it('offers Retry first on a stopped rewrite, with the alternatives behind it', () => {
    const stopped = event({
      id: 'ev-1',
      kind: 'history_stopped',
      at: '2026-09-26T10:00:00.000Z',
      payload: { origin: 'plan', reason: 'conflict', files: ['src/ledger/postings.ts'] },
    });

    expect(historyRowControls({ event: stopped, events: [stopped] })).toEqual({
      primary: 'retry',
      secondary: ['rewrite-with-agent', 'change-plan', 'discard-plan'],
    });
    expect(text({ value: stopped })).toBe(
      'Rewrite of fix/ledger-postings stopped · conflict in src/ledger/postings.ts',
    );
  });

  it('offers to bring origin into the plan when the lease refused the push', () => {
    const moved = event({
      id: 'ev-1',
      kind: 'history_stopped',
      at: '2026-09-26T10:00:00.000Z',
      payload: { origin: 'plan', reason: 'origin-moved' },
    });

    expect(historyRowControls({ event: moved, events: [moved] })).toEqual({
      primary: 'bring-origin',
      secondary: [],
    });
  });

  it('asks for a note when the history rewriter could not merge', () => {
    const stuck = event({
      id: 'ev-1',
      kind: 'history_stopped',
      at: '2026-09-26T10:00:00.000Z',
      payload: { origin: 'plan', reason: 'stuck', files: ['src/ledger/postings.ts'] },
    });

    expect(historyRowControls({ event: stuck, events: [stuck] })?.primary).toBe('retry-with-note');
    expect(text({ value: stuck })).toContain(
      "History rewriter couldn't merge src/ledger/postings.ts",
    );
  });

  it('drops the verbs of a row a later outcome of the same branch settled', () => {
    const stopped = event({
      id: 'ev-1',
      kind: 'history_stopped',
      at: '2026-09-26T10:00:00.000Z',
      payload: { origin: 'rebase', reason: 'conflict' },
    });
    const rewritten = event({
      id: 'ev-2',
      kind: 'history_rewritten',
      at: '2026-09-26T10:05:00.000Z',
      payload: { origin: 'rebase', backupRef: 'refs/goodboy/backup/fix/1' },
    });

    expect(historyRowControls({ event: stopped, events: [stopped, rewritten] })).toBeNull();
    expect(historyRowControls({ event: rewritten, events: [stopped, rewritten] })).toEqual({
      primary: 'undo',
      secondary: [],
    });
    expect(text({ value: rewritten })).toBe('Rebased fix/ledger-postings on main');
  });

  it('keeps a stopped rewrite visible under any filter', () => {
    const stopped = event({
      id: 'ev-1',
      kind: 'history_stopped',
      at: '2026-09-26T10:00:00.000Z',
      payload: { origin: 'plan', reason: 'conflict' },
    });
    const entry = {
      kind: 'event' as const,
      id: 'event:ev-1',
      at: stopped.createdAt,
      event: stopped,
    };
    expect(activityCategoryOf({ entry })).toBe('worktree');

    const shown = filterTimelineEntries({
      entries: [entry],
      filter: { ...DEFAULT_ACTIVITY_FILTER, worktree: false },
    });
    expect(shown).toHaveLength(1);
  });
});
