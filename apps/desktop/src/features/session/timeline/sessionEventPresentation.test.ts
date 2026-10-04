// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionEvent, SessionEventKind, SessionEventPayload } from '@goodboy/types';
import { SESSION_EVENT_KINDS } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { PULL_REQUEST_PRESENTATION } from '../../../shared/pullRequestPresentation';
import {
  decisionDiff,
  isEmptyDecisionDiff,
  TIMELINE_PROJECT_NAME_LIMIT,
  segmentsToText,
  sessionEventEmphasis,
  sessionEventGlyph,
  sessionEventLabel,
  sessionEventProjectRunLabel,
  sessionEventSecondary,
  decisionCountsText,
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

describe('sessionEventLabel as text', () => {
  it('reads the container event as the session folder, path included', () => {
    expect(
      segmentsToText({
        segments: sessionEventLabel({
          event: event({
            kind: 'worktree_created',
            payload: { worktreePath: '/repo/wt/gb-trace' },
          }),
        }),
      }),
    ).toBe('Session folder created at /repo/wt/gb-trace');
  });

  it('names both branches of a switch', () => {
    expect(
      segmentsToText({
        segments: sessionEventLabel({
          event: event({ kind: 'branch_switched', payload: { from: 'main', to: 'ak/feat' } }),
        }),
      }),
    ).toBe('Branch main → ak/feat');
  });

  it('reads a created branch with the name inside the sentence', () => {
    expect(
      segmentsToText({
        segments: sessionEventLabel({
          event: event({ kind: 'branch_created', payload: { branch: 'ak/feat' } }),
        }),
      }),
    ).toBe('Branch ak/feat created');
  });

  it('reads an issue by identifier and title', () => {
    expect(
      segmentsToText({
        segments: sessionEventLabel({
          event: event({
            kind: 'issue_unlinked',
            payload: { identifier: 'GB-1', title: 'Persist the trace' },
          }),
        }),
      }),
    ).toBe('Removed link to GB-1: Persist the trace');
  });

  it('reads a pull request by number', () => {
    expect(
      segmentsToText({
        segments: sessionEventLabel({
          event: event({ kind: 'pr_merged', payload: { number: 42 } }),
        }),
      }),
    ).toBe('#42 merged');
  });

  it('pairs a discard with its restore', () => {
    const payload = { workflowName: 'Orchestrated workflow 24' };
    expect(
      segmentsToText({
        segments: sessionEventLabel({ event: event({ kind: 'workflow_discarded', payload }) }),
      }),
    ).toBe('Orchestrated workflow 24 discarded');
    expect(
      segmentsToText({
        segments: sessionEventLabel({ event: event({ kind: 'workflow_restored', payload }) }),
      }),
    ).toBe('Orchestrated workflow 24 restored');
  });

  it('names the run the user closed', () => {
    const payload = { workflowName: 'Add rate limiting' };
    expect(
      segmentsToText({
        segments: sessionEventLabel({ event: event({ kind: 'workflow_closed', payload }) }),
      }),
    ).toBe('Closed Add rate limiting by you');
    expect(sessionEventEmphasis({ kind: 'workflow_closed' })).toBe('muted');
  });

  it('names a decision change as context and leaves the counts to the diff', () => {
    expect(
      segmentsToText({
        segments: sessionEventLabel({
          event: event({ kind: 'decisions_changed', payload: { added: 3, removed: 1 } }),
        }),
      }),
    ).toBe('Context');
  });

  it('counts a replacement on both sides of the diff, like a changed line', () => {
    expect(
      decisionDiff({
        payload: { added: 1, replaced: 1, withdrawn: 1, merged: 2, restored: 1 },
      }),
    ).toEqual({ additions: 3, deletions: 4 });
  });

  it('reads a legacy count-only payload as the same diff', () => {
    expect(decisionDiff({ payload: { added: 3, removed: 1 } })).toEqual({
      additions: 3,
      deletions: 1,
    });
  });

  it('treats a change with nothing added or removed as empty', () => {
    expect(isEmptyDecisionDiff({ payload: { added: 0, removed: 0 } })).toBe(true);
    expect(isEmptyDecisionDiff({ payload: null })).toBe(true);
    expect(isEmptyDecisionDiff({ payload: { withdrawn: 1 } })).toBe(false);
  });

  it('names a consolidation and what set it off', () => {
    expect(
      segmentsToText({
        segments: sessionEventLabel({
          event: event({
            kind: 'decisions_changed',
            payload: {
              added: 0,
              replaced: 0,
              withdrawn: 1,
              merged: 2,
              restored: 0,
              consolidatedAfter: '#612 merged',
            },
          }),
        }),
      }),
    ).toBe('Context consolidated after #612 merged');
  });

  it('names the mounted project first when the payload carries it', () => {
    expect(
      segmentsToText({
        segments: sessionEventLabel({
          event: event({
            kind: 'project_materialized',
            payload: { projectName: 'api', branch: 'goodboy/untitled', reason: 'added manually' },
          }),
        }),
      }),
    ).toBe('Added api on goodboy/untitled');
  });

  it('falls back to the old mount copy without a project name, rationale left out', () => {
    expect(
      segmentsToText({
        segments: sessionEventLabel({
          event: event({
            kind: 'project_materialized',
            payload: { branch: 'goodboy/untitled', reason: 'added manually by the user' },
          }),
        }),
      }),
    ).toBe('Project added on goodboy/untitled');
  });

  it('names the detached project and whether the worktree survived', () => {
    expect(
      segmentsToText({
        segments: sessionEventLabel({
          event: event({ kind: 'project_detached', payload: { projectName: 'api', kept: true } }),
        }),
      }),
    ).toBe('Removed api');
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

  it('drops the mount rationale entirely, on the row and beside it', () => {
    const mounted = event({
      kind: 'project_materialized',
      payload: {
        projectName: 'api',
        branch: 'goodboy/untitled',
        reason: 'step "migrazione cluster 1": 7. Apertura imperativa da file .ts',
      },
    });

    expect(sessionEventSecondary({ event: mounted })).toBeNull();
    expect(segmentsToText({ segments: sessionEventLabel({ event: mounted }) })).toBe(
      'Added api on goodboy/untitled',
    );
  });

  it('keeps the refusal reason, which is the whole point of that payload', () => {
    expect(
      segmentsToText({
        segments: sessionEventLabel({
          event: event({
            kind: 'project_materialization_refused',
            payload: { projectName: 'api', reason: 'branch already checked out' },
          }),
        }),
      }),
    ).toBe("Couldn't add api: branch already checked out");
  });

  it('stays readable when the payload is missing', () => {
    for (const kind of SESSION_EVENT_KINDS) {
      expect(
        segmentsToText({ segments: sessionEventLabel({ event: event({ kind }) }) }).length,
      ).toBeGreaterThan(0);
    }
  });
});

describe('sessionEventLabel', () => {
  it('splits a mount into prose and the two values it names', () => {
    expect(
      sessionEventLabel({
        event: event({
          kind: 'project_materialized',
          payload: { projectName: 'api', branch: 'goodboy/untitled' },
        }),
      }),
    ).toEqual([
      { kind: 'text', text: 'Added ' },
      { kind: 'value', text: 'api', variant: 'project' },
      { kind: 'text', text: ' on ' },
      { kind: 'value', text: 'goodboy/untitled', variant: 'branch' },
    ]);
  });

  it('carries the worktree path as a value, not as prose', () => {
    expect(
      sessionEventLabel({
        event: event({ kind: 'worktree_created', payload: { worktreePath: '/repo/wt/gb-trace' } }),
      }),
    ).toEqual([
      { kind: 'text', text: 'Session folder created at ' },
      { kind: 'value', text: '/repo/wt/gb-trace', variant: 'path' },
    ]);
  });

  it('tokenizes the pull request number and leaves its title as prose', () => {
    expect(
      sessionEventLabel({
        event: event({ kind: 'pr_created', payload: { number: 42, title: 'Segment the labels' } }),
      }),
    ).toEqual([
      { kind: 'text', text: 'Opened ' },
      { kind: 'value', text: '#42', variant: 'pull-request' },
      { kind: 'text', text: ': Segment the labels' },
    ]);
  });

  it('tokenizes the issue identifier and leaves its title as prose', () => {
    expect(
      sessionEventLabel({
        event: event({
          kind: 'issue_linked',
          payload: { identifier: 'GB-1', title: 'Persist the trace' },
        }),
      }),
    ).toEqual([
      { kind: 'text', text: 'Linked ' },
      { kind: 'value', text: 'GB-1', variant: 'issue' },
      { kind: 'text', text: ': Persist the trace' },
    ]);
  });

  it('leaves a count-only event as one plain run of text', () => {
    expect(
      sessionEventLabel({
        event: event({ kind: 'decisions_changed', payload: { added: 3, removed: 1 } }),
      }).every((segment) => segment.kind === 'text'),
    ).toBe(true);
  });

  it('falls back to prose when the payload names no value', () => {
    for (const kind of SESSION_EVENT_KINDS) {
      const segments = sessionEventLabel({ event: event({ kind }) });
      expect(segments.length).toBeGreaterThan(0);
      expect(segments.every((segment) => segment.kind === 'text')).toBe(true);
    }
  });
});

describe('sessionEventEmphasis', () => {
  it('uses the shared pull request colors', () => {
    expect(sessionEventEmphasis({ kind: 'pr_created' })).toBe('success');
    expect(sessionEventEmphasis({ kind: 'pr_ready' })).toBe('success');
    expect(sessionEventEmphasis({ kind: 'pr_approved' })).toBe('success');
    expect(sessionEventEmphasis({ kind: 'pr_merged' })).toBe('merged');
    expect(sessionEventEmphasis({ kind: 'pr_closed' })).toBe('danger');
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

  it('marks a decision change with the decisions concept and names it Context', () => {
    const glyph = sessionEventGlyph({ kind: 'decisions_changed' });
    expect(glyph.icon).toBe(CONCEPT_ICONS.decisions);
    expect(glyph.tone).toBe(CONCEPT_TONE.decisions);
    expect(glyph.label).toBe('Context');
  });

  it('uses the shared pull request glyphs and tones', () => {
    for (const [kind, state] of [
      ['pr_created', 'open'],
      ['pr_ready', 'open'],
      ['pr_approved', 'approved'],
      ['pr_merged', 'merged'],
      ['pr_closed', 'closed'],
    ] satisfies ReadonlyArray<
      readonly [SessionEventKind, keyof typeof PULL_REQUEST_PRESENTATION]
    >) {
      const glyph = sessionEventGlyph({ kind });
      const presentation = PULL_REQUEST_PRESENTATION[state];
      expect(glyph.icon).toBe(presentation.icon);
      expect(glyph.tone).toBe(presentation.tone);
    }
  });
});

describe('sessionEventProjectRunLabel', () => {
  it('reads a run of detachments as one sentence with a serial list', () => {
    expect(
      segmentsToText({
        segments: sessionEventProjectRunLabel({
          mounted: [],
          detached: ['api', 'storefront-web', 'infra'],
        }),
      }),
    ).toBe('Removed api, storefront-web and infra');
  });

  it('says both verbs in one sentence, mounted first', () => {
    expect(
      segmentsToText({
        segments: sessionEventProjectRunLabel({
          mounted: ['api'],
          detached: ['storefront-web', 'infra'],
        }),
      }),
    ).toBe('Added api, removed storefront-web and infra');
  });

  it('keeps each list readable when both verbs name more than one project', () => {
    expect(
      segmentsToText({
        segments: sessionEventProjectRunLabel({
          mounted: ['api', 'storefront-web'],
          detached: ['infra'],
        }),
      }),
    ).toBe('Added api and storefront-web, removed infra');
  });

  it('keeps every project name a chip, never prose', () => {
    expect(sessionEventProjectRunLabel({ mounted: ['api'], detached: ['storefront-web'] })).toEqual(
      [
        { kind: 'text', text: 'Added ' },
        { kind: 'value', text: 'api', variant: 'project' },
        { kind: 'text', text: ', removed ' },
        { kind: 'value', text: 'storefront-web', variant: 'project' },
      ],
    );
  });

  it(`names ${TIMELINE_PROJECT_NAME_LIMIT} projects and counts the rest`, () => {
    expect(
      segmentsToText({
        segments: sessionEventProjectRunLabel({
          mounted: [],
          detached: ['api', 'storefront-web', 'infra', 'db', 'edge', 'docs', 'cli'],
        }),
      }),
    ).toBe('Removed api, storefront-web, infra and 4 more');
  });

  it('names the last project rather than counting one hidden name', () => {
    expect(
      segmentsToText({
        segments: sessionEventProjectRunLabel({
          mounted: [],
          detached: ['api', 'storefront-web', 'infra', 'db'],
        }),
      }),
    ).toBe('Removed api, storefront-web, infra and db');
  });

  it('truncates each verb on its own so neither disappears', () => {
    expect(
      segmentsToText({
        segments: sessionEventProjectRunLabel({
          mounted: ['api', 'storefront-web', 'infra', 'db', 'edge'],
          detached: ['docs', 'cli', 'agents', 'ui', 'core'],
        }),
      }),
    ).toBe('Added api, storefront-web, infra and 2 more, removed docs, cli, agents and 2 more');
  });

  it('names every project when the caller lifts the limit, as a tooltip does', () => {
    const names = ['api', 'storefront-web', 'infra', 'db', 'edge'];

    expect(
      segmentsToText({
        segments: sessionEventProjectRunLabel({
          mounted: [],
          detached: names,
          limit: names.length,
        }),
      }),
    ).toBe('Removed api, storefront-web, infra, db and edge');
  });
});

describe('durable state change events', () => {
  it('names an archive and a restore without decoration', () => {
    expect(
      segmentsToText({
        segments: sessionEventLabel({ event: event({ kind: 'session_archived' }) }),
      }),
    ).toBe('Session archived');
    expect(
      segmentsToText({
        segments: sessionEventLabel({ event: event({ kind: 'session_restored' }) }),
      }),
    ).toBe('Session restored');
  });

  it('names the project and branch writes go to', () => {
    expect(
      segmentsToText({
        segments: sessionEventLabel({
          event: event({
            kind: 'write_destination_changed',
            payload: { projectName: 'storefront-web', branch: 'ak/feat-x' },
          }),
        }),
      }),
    ).toBe('Writes now go to storefront-web on ak/feat-x');
  });

  it('falls back when the destination payload carries no project', () => {
    expect(
      segmentsToText({
        segments: sessionEventLabel({ event: event({ kind: 'write_destination_changed' }) }),
      }),
    ).toBe('Write destination changed');
  });

  it('quotes the discarded question and the one brought back', () => {
    expect(
      segmentsToText({
        segments: sessionEventLabel({
          event: event({ kind: 'question_dismissed', payload: { title: 'Which base branch?' } }),
        }),
      }),
    ).toBe('Question discarded: Which base branch?');
    expect(
      segmentsToText({
        segments: sessionEventLabel({
          event: event({ kind: 'question_restored', payload: { title: 'Which base branch?' } }),
        }),
      }),
    ).toBe('Question brought back: Which base branch?');
  });
});

describe('decisionCountsText', () => {
  it('words the context counts instead of a code diff', () => {
    expect(decisionCountsText({ payload: { added: 1, replaced: 2 } })).toBe('1 added, 2 replaced');
    expect(decisionCountsText({ payload: { removed: 3, withdrawn: 1, merged: 2 } })).toBe(
      '3 removed, 1 withdrawn, 2 merged',
    );
  });

  it('says nothing when nothing changed', () => {
    expect(decisionCountsText({ payload: { added: 0, removed: 0 } })).toBeNull();
    expect(decisionCountsText({ payload: null })).toBeNull();
  });
});
