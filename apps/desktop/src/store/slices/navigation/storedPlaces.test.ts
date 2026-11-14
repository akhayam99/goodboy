// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type MountId, type SessionId } from '@goodboy/types';
import { branchPlace, sessionPlace } from './place';
import { PLACE_ROWS } from './placeRows';
import { opensInPreviousRelease } from './testing/opensInPreviousRelease';
import { EMPTY_FOCUS, type Location, type Place } from './types';
import { withoutRemovedPages } from './withoutRemovedPages';

const S1 = brandId<SessionId>({ value: 'session-ledger-core' });
const LEAD = brandId<AgentId>({ value: 'agent-lead' });
const MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });
const WORKTREE = '/work/ledger-core';

type StoredParams = {
  readonly lens: string | null;
  readonly target?: unknown;
  readonly agentId?: string | null;
  readonly drawer?: unknown;
};

const stored = ({ lens, target = null, agentId = null, drawer = null }: StoredParams): Location =>
  JSON.parse(
    JSON.stringify({
      workspaceId: null,
      place: { at: 'session', sessionId: S1, view: { lens, agentId, target } },
      studio: null,
      focus: { drawer, scroll: {} },
    }),
  );

type Fold = {
  readonly lens: string | null;
  readonly target?: unknown;
  readonly drawer?: unknown;
  readonly rows?: Readonly<Record<string, string>>;
};

type Row = readonly [string, Location, Fold];

type PanelParams = {
  readonly kind: string;
  readonly payload: unknown;
};

const panel = ({ kind, payload }: PanelParams): Location =>
  stored({ lens: 'workflows', drawer: { kind, sessionId: S1, payload } });

const STORED_PLACES: ReadonlyArray<Row> = [
  ['the Overview', stored({ lens: null }), { lens: null }],
  ['the Runs page', stored({ lens: 'workflows' }), { lens: 'workflows' }],
  ['the Artifacts page', stored({ lens: 'plans' }), { lens: 'plans' }],
  ['the Questions page', stored({ lens: 'questions' }), { lens: 'questions' }],
  [
    'the Changes page',
    stored({ lens: 'files', target: { kind: 'diff', mountPath: WORKTREE, focus: null } }),
    { lens: 'files', target: { kind: 'diff', mountPath: WORKTREE, focus: null } },
  ],
  ...(['goal', 'decisions', 'summary', 'explanations'] as const).map((section): Row => [
    `the Context panel on ${section}`,
    panel({ kind: 'context', payload: { section, view: 'current' } }),
    { lens: 'context', drawer: null, rows: { [PLACE_ROWS.contextSection]: section } },
  ]),
  [
    'the Context panel on its history',
    panel({ kind: 'context', payload: { section: 'goal', view: 'versions' } }),
    { lens: 'context', drawer: null, rows: { [PLACE_ROWS.contextSection]: 'history' } },
  ],
  [
    'the Ask panel',
    panel({ kind: 'ask', payload: null }),
    { lens: 'context', drawer: null, rows: { [PLACE_ROWS.contextSection]: 'ask' } },
  ],
  [
    'the Agents panel',
    stored({ lens: 'questions', drawer: { kind: 'spawned', sessionId: S1, payload: null } }),
    { lens: 'workflows', drawer: null, rows: { [PLACE_ROWS.runsFilter]: 'running' } },
  ],
  [
    'the Agents page',
    stored({ lens: 'agents' }),
    { lens: 'workflows', rows: { [PLACE_ROWS.runsFilter]: 'running' } },
  ],
  [
    'the Scripts panel',
    panel({ kind: 'scripts', payload: null }),
    { lens: 'workflows', drawer: { kind: 'scripts', sessionId: S1, payload: null } },
  ],
  [
    'a script run',
    panel({ kind: 'scriptRun', payload: { scriptKey: 'test', mountId: MOUNT, from: 'scripts' } }),
    {
      lens: 'workflows',
      drawer: {
        kind: 'scriptRun',
        sessionId: S1,
        payload: { scriptKey: 'test', mountId: MOUNT, from: 'scripts' },
      },
    },
  ],
  [
    'the Scripts page',
    stored({ lens: 'scripts' }),
    { lens: null, drawer: { kind: 'scripts', sessionId: S1, payload: null } },
  ],
  [
    'the Explore panel',
    panel({ kind: 'explore', payload: null }),
    { lens: 'files', drawer: null, rows: { [PLACE_ROWS.changesMode]: 'all' } },
  ],
  [
    'a file opened from the Explore tree',
    panel({
      kind: 'explore-file',
      payload: {
        sessionDir: WORKTREE,
        entry: { relPath: 'src/ledger.ts', name: 'ledger.ts', isDir: false },
        from: 'explore',
      },
    }),
    {
      lens: 'files',
      target: { kind: 'diff', mountPath: null, focus: { kind: 'branch', path: 'src/ledger.ts' } },
      drawer: null,
      rows: { [PLACE_ROWS.changesMode]: 'all' },
    },
  ],
  [
    'a file opened from a link',
    panel({
      kind: 'explore-file',
      payload: {
        sessionDir: WORKTREE,
        entry: { relPath: 'src/ledger.ts', name: 'ledger.ts', isDir: false },
      },
    }),
    {
      lens: 'workflows',
      drawer: {
        kind: 'explore-file',
        sessionId: S1,
        payload: {
          sessionDir: WORKTREE,
          entry: { relPath: 'src/ledger.ts', name: 'ledger.ts', isDir: false },
        },
      },
    },
  ],
  [
    'the full log',
    panel({ kind: 'session-log', payload: { focusEntryId: null } }),
    {
      lens: 'workflows',
      drawer: { kind: 'session-log', sessionId: S1, payload: { focusEntryId: null } },
    },
  ],
  ...(
    [
      ['an artifact', 'artifact-document', { artifactId: 'artifact-plan', revision: null }],
      ['a transcript', 'transcript', { agentId: 'agent-scout' }],
      ['a question', 'question', { questionId: 'question-1' }],
      [
        'a file diff',
        'file-diff',
        { source: { kind: 'worktree', worktreePath: WORKTREE }, path: null },
      ],
      ['a check analysis', 'check-analysis', { sessionId: S1, mountId: MOUNT, checkUrl: 'ci' }],
      ['a plan part', 'plan-part', { planId: 'artifact-plan', index: 1 }],
    ] as const
  ).map(([name, kind, payload]): Row => [
    `the reading panel of ${name}`,
    panel({ kind, payload }),
    { lens: 'workflows', drawer: { kind, sessionId: S1, payload } },
  ]),
  ['an unknown page', stored({ lens: 'timeline' }), { lens: null, target: null }],
  [
    'an unknown page on an agent',
    stored({ lens: 'board-lane', agentId: 'agent-lead' }),
    { lens: null, target: null },
  ],
];

describe('the stored places table', () => {
  it.each(STORED_PLACES)('opens %s at its new home', (_name, before, after) => {
    const next = withoutRemovedPages({ location: before });

    expect(next.place.at).toBe('session');
    expect(next.place.at === 'session' ? next.place.view.lens : undefined).toBe(after.lens);
    if (after.target !== undefined) {
      expect(next.place.at === 'session' ? next.place.view.target : undefined).toEqual(
        after.target,
      );
    }
    if (after.drawer !== undefined) {
      expect(next.focus.drawer).toEqual(after.drawer);
    }
    expect(next.focus.returnRows ?? {}).toEqual(after.rows ?? {});
  });

  it('never lands an unknown page on a blank page', () => {
    const next = withoutRemovedPages({ location: stored({ lens: 'timeline', agentId: 'x' }) });

    expect(next.place).toEqual(sessionPlace({ sessionId: S1 }));
  });

  it('keeps the rows a place already had when a panel folds', () => {
    const explore = panel({ kind: 'explore', payload: null });
    const before: Location = {
      ...explore,
      focus: { ...explore.focus, returnRows: { runs: 'run-1' } },
    };

    expect(withoutRemovedPages({ location: before }).focus.returnRows).toEqual({
      runs: 'run-1',
      [PLACE_ROWS.changesMode]: 'all',
    });
  });
});

type SavedParams = {
  readonly place: Place;
  readonly rows?: Readonly<Record<string, string>>;
};

const saved = ({ place, rows }: SavedParams): Location => ({
  workspaceId: null,
  place,
  studio: null,
  focus: rows === undefined ? EMPTY_FOCUS : { ...EMPTY_FOCUS, returnRows: rows },
});

const NEW_PLACES: ReadonlyArray<readonly [string, Location]> = [
  ['the Context tab', saved({ place: sessionPlace({ sessionId: S1, lens: 'context' }) })],
  [
    'the Context tab on a section',
    saved({
      place: sessionPlace({ sessionId: S1, lens: 'context' }),
      rows: { [PLACE_ROWS.contextSection]: 'decisions' },
    }),
  ],
  [
    'the Changes tab on a branch',
    saved({
      place: sessionPlace({
        sessionId: S1,
        lens: 'files',
        target: { kind: 'diff', mountPath: WORKTREE, focus: null },
      }),
    }),
  ],
  [
    'the Changes tab on All files with a file',
    saved({
      place: sessionPlace({
        sessionId: S1,
        lens: 'files',
        target: {
          kind: 'diff',
          mountPath: WORKTREE,
          focus: { kind: 'branch', path: 'src/ledger.ts' },
        },
      }),
      rows: { [PLACE_ROWS.changesMode]: 'all' },
    }),
  ],
  [
    'Runs filtered to Running',
    saved({
      place: sessionPlace({ sessionId: S1, lens: 'workflows' }),
      rows: { [PLACE_ROWS.runsFilter]: 'running' },
    }),
  ],
  [
    'the Lead page',
    saved({ place: sessionPlace({ sessionId: S1, lens: 'workflows', agentId: LEAD }) }),
  ],
  [
    'the Overview with a Lead row',
    saved({
      place: sessionPlace({ sessionId: S1 }),
      rows: { [PLACE_ROWS.boardLead]: LEAD },
    }),
  ],
  [
    'the Work tab of a pull request',
    saved({ place: branchPlace({ sessionId: S1, mountPath: WORKTREE, tab: 'work' }) }),
  ],
];

describe('the previous release opens every place this build stores', () => {
  it.each(NEW_PLACES)('opens %s', (_name, location) => {
    expect(opensInPreviousRelease({ location })).toBe(true);
  });

  it.each(STORED_PLACES)('opens the new home of %s', (_name, before) => {
    expect(opensInPreviousRelease({ location: withoutRemovedPages({ location: before }) })).toBe(
      true,
    );
  });

  it('would not open a kind it never knew', () => {
    const unknown = saved({ place: sessionPlace({ sessionId: S1 }) });
    const withDrawer: Location = JSON.parse(
      JSON.stringify({ ...unknown, focus: { drawer: { kind: 'lead-record', sessionId: S1 } } }),
    );

    expect(opensInPreviousRelease({ location: withDrawer })).toBe(false);
  });
});
