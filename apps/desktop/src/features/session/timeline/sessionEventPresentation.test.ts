import { describe, expect, it } from 'vitest';
import type { SessionEvent, SessionEventKind, SessionEventPayload } from '@goodboy/types';
import { SESSION_EVENT_KINDS } from '@goodboy/types';
import {
  sessionEventEmphasis,
  sessionEventGlyph,
  sessionEventTitle,
} from './sessionEventPresentation';

type MakeParams = {
  readonly kind: SessionEventKind;
  readonly payload?: SessionEventPayload;
};

const event = ({ kind, payload }: MakeParams): SessionEvent =>
  ({
    id: 'ev-1',
    sessionId: 'session-1',
    kind,
    payload: payload ?? null,
    createdAt: '2026-08-21T10:00:00.000Z',
  }) as unknown as SessionEvent;

describe('sessionEventTitle', () => {
  it('shows the worktree path so it can be copied', () => {
    expect(
      sessionEventTitle({
        event: event({ kind: 'worktree_created', payload: { worktreePath: '/repo/wt/gb-trace' } }),
      }),
    ).toBe('/repo/wt/gb-trace');
  });

  it('names both branches of a switch', () => {
    expect(
      sessionEventTitle({
        event: event({ kind: 'branch_switched', payload: { from: 'main', to: 'ak/feat' } }),
      }),
    ).toBe('Branch switched: main → ak/feat');
  });

  it('reads an issue by identifier and title', () => {
    expect(
      sessionEventTitle({
        event: event({
          kind: 'issue_unlinked',
          payload: { identifier: 'GB-1', title: 'Persist the trace' },
        }),
      }),
    ).toBe('Unlinked GB-1: Persist the trace');
  });

  it('reads a pull request by number', () => {
    expect(
      sessionEventTitle({ event: event({ kind: 'pr_merged', payload: { number: 42 } }) }),
    ).toBe('#42 merged');
  });

  it('pairs a discard with its restore', () => {
    const payload = { workflowName: 'Orchestrated workflow 24' };
    expect(sessionEventTitle({ event: event({ kind: 'workflow_discarded', payload }) })).toBe(
      'Orchestrated workflow 24 discarded',
    );
    expect(sessionEventTitle({ event: event({ kind: 'workflow_restored', payload }) })).toBe(
      'Orchestrated workflow 24 restored',
    );
  });

  it('counts decisions on both sides', () => {
    expect(
      sessionEventTitle({
        event: event({ kind: 'decisions_changed', payload: { added: 3, removed: 1 } }),
      }),
    ).toBe('3 decisions added, 1 removed');
  });

  it('keeps a single decision singular', () => {
    expect(
      sessionEventTitle({
        event: event({ kind: 'decisions_changed', payload: { added: 1, removed: 0 } }),
      }),
    ).toBe('1 decision added, 0 removed');
  });

  it('stays readable when the payload is missing', () => {
    for (const kind of SESSION_EVENT_KINDS) {
      expect(sessionEventTitle({ event: event({ kind }) }).length).toBeGreaterThan(0);
    }
  });
});

describe('sessionEventEmphasis', () => {
  it('celebrates an approval and a merge', () => {
    expect(sessionEventEmphasis({ kind: 'pr_approved' })).toBe('success');
    expect(sessionEventEmphasis({ kind: 'pr_merged' })).toBe('success');
  });

  it('dims what was taken away', () => {
    expect(sessionEventEmphasis({ kind: 'issue_unlinked' })).toBe('muted');
    expect(sessionEventEmphasis({ kind: 'workflow_discarded' })).toBe('muted');
    expect(sessionEventEmphasis({ kind: 'workflow_deleted' })).toBe('muted');
    expect(sessionEventEmphasis({ kind: 'decisions_changed' })).toBe('muted');
  });

  it('brings a restored run back to full weight', () => {
    expect(sessionEventEmphasis({ kind: 'workflow_restored' })).toBe('plain');
    expect(sessionEventEmphasis({ kind: 'workflow_restored' })).toBe(
      sessionEventEmphasis({ kind: 'workflow_started' }),
    );
  });
});

describe('sessionEventGlyph', () => {
  it('gives every kind a glyph', () => {
    for (const kind of SESSION_EVENT_KINDS) {
      expect(sessionEventGlyph({ kind }).label.length).toBeGreaterThan(0);
    }
  });
});
