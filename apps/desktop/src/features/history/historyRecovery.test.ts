// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  SessionEvent,
  SessionEventId,
  SessionEventKind,
  SessionEventPayload,
  SessionId,
} from '@goodboy/types';
import { hasHistoryRecovery } from './historyRecovery';
import { sessionEventLabel } from '../session/timeline/sessionEventPresentation';
import { entriesOfView } from '../session/timeline/activityView';

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
  it('keeps a stopped rewrite as a recoverable row and says why it stopped', () => {
    const stopped = event({
      id: 'ev-1',
      kind: 'history_stopped',
      at: '2026-09-26T10:00:00.000Z',
      payload: { origin: 'plan', reason: 'conflict', files: ['src/ledger/postings.ts'] },
    });

    expect(hasHistoryRecovery({ event: stopped, events: [stopped] })).toBe(true);
    expect(text({ value: stopped })).toBe(
      'Rewrite of fix/ledger-postings stopped · conflict in src/ledger/postings.ts',
    );
  });

  it('says when the history rewriter could not merge', () => {
    const stuck = event({
      id: 'ev-1',
      kind: 'history_stopped',
      at: '2026-09-26T10:00:00.000Z',
      payload: { origin: 'plan', reason: 'stuck', files: ['src/ledger/postings.ts'] },
    });

    expect(hasHistoryRecovery({ event: stuck, events: [stuck] })).toBe(true);
    expect(text({ value: stuck })).toContain(
      "History rewriter couldn't merge src/ledger/postings.ts",
    );
  });

  it('keeps a rewrite only while it has a backup to go back to', () => {
    const withBackup = event({
      id: 'ev-1',
      kind: 'history_rewritten',
      at: '2026-09-26T10:00:00.000Z',
      payload: { origin: 'plan', backupRef: 'refs/goodboy/backup/fix/1' },
    });
    const withoutBackup = event({
      id: 'ev-2',
      kind: 'history_rewritten',
      at: '2026-09-26T10:00:00.000Z',
      payload: { origin: 'plan' },
    });

    expect(hasHistoryRecovery({ event: withBackup, events: [withBackup] })).toBe(true);
    expect(hasHistoryRecovery({ event: withoutBackup, events: [withoutBackup] })).toBe(false);
  });

  it('drops a row a later outcome of the same branch settled', () => {
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

    expect(hasHistoryRecovery({ event: stopped, events: [stopped, rewritten] })).toBe(false);
    expect(hasHistoryRecovery({ event: rewritten, events: [stopped, rewritten] })).toBe(true);
    expect(text({ value: rewritten })).toBe('Rebased fix/ledger-postings on main');
  });

  it('sends a stopped rewrite to Needs you while it is open and to the Log once superseded', () => {
    const stopped = event({
      id: 'ev-1',
      kind: 'history_stopped',
      at: '2026-09-26T10:00:00.000Z',
      payload: { origin: 'plan', reason: 'conflict' },
    });
    const rewritten = event({
      id: 'ev-2',
      kind: 'history_rewritten',
      at: '2026-09-26T10:05:00.000Z',
      payload: { origin: 'plan', backupRef: 'refs/goodboy/backup' },
    });
    const entry = {
      kind: 'event' as const,
      id: 'event:ev-1',
      at: stopped.createdAt,
      event: stopped,
    };

    const homes = ({ events }: { readonly events: ReadonlyArray<SessionEvent> }) =>
      (['activity', 'log'] as const).filter(
        (view) => entriesOfView({ entries: [entry], events, view }).length === 1,
      );

    expect(homes({ events: [stopped] })).toEqual([]);
    expect(homes({ events: [stopped, rewritten] })).toEqual(['log']);
  });
});
