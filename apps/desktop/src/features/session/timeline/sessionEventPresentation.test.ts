import { describe, expect, it } from 'vitest';
import type { SessionEvent, SessionEventKind, SessionEventPayload } from '@goodboy/types';
import { SESSION_EVENT_KINDS } from '@goodboy/types';
import {
  sessionEventEmphasis,
  sessionEventGlyph,
  sessionEventSecondary,
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

  it('names the mounted project first when the payload carries it', () => {
    expect(
      sessionEventTitle({
        event: event({
          kind: 'project_materialized',
          payload: { projectName: 'api', branch: 'goodboy/untitled', reason: 'added manually' },
        }),
      }),
    ).toBe('Mounted api on goodboy/untitled');
  });

  it('falls back to the old mount copy without a project name', () => {
    expect(
      sessionEventTitle({
        event: event({
          kind: 'project_materialized',
          payload: { branch: 'goodboy/untitled', reason: 'added manually by the user' },
        }),
      }),
    ).toBe('Project mounted on goodboy/untitled: added manually by the user');
  });

  it('names the detached project and whether the worktree survived', () => {
    expect(
      sessionEventTitle({
        event: event({ kind: 'project_detached', payload: { projectName: 'api', kept: true } }),
      }),
    ).toBe('Detached api');
    expect(
      sessionEventSecondary({
        event: event({ kind: 'project_detached', payload: { projectName: 'api', kept: true } }),
      }),
    ).toBe('worktree kept on disk');
    expect(
      sessionEventSecondary({
        event: event({ kind: 'project_detached', payload: { projectName: 'api', kept: false } }),
      }),
    ).toBeNull();
  });

  it('keeps the mount rationale as the quiet secondary part', () => {
    expect(
      sessionEventSecondary({
        event: event({
          kind: 'project_materialized',
          payload: { projectName: 'api', reason: 'added manually by the user' },
        }),
      }),
    ).toBe('added manually by the user');
    expect(
      sessionEventSecondary({
        event: event({ kind: 'project_materialized', payload: { reason: 'added manually' } }),
      }),
    ).toBeNull();
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
