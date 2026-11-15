// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type OpenQuestionId,
  type SessionId,
} from '@goodboy/types';
import { DRAWER_KINDS } from '../../store/slices/drawer/drawerKinds';
import { LENS_KINDS } from '../../store/slices/session-view/types';
import { BOARD_PLACE, branchPlace, sessionPlace } from '../../store/slices/navigation/place';
import { PLACE_ROWS } from '../../store/slices/navigation/placeRows';
import { opensInPreviousRelease } from '../../store/slices/navigation/testing/opensInPreviousRelease';
import {
  EMPTY_FOCUS,
  type BranchTab,
  type Location,
  type Place,
  type SessionTarget,
} from '../../store/slices/navigation/types';
import { PREVIOUS_BUILD_BLOBS } from './previousBuildBlobs';

const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });
const LEAD = brandId<AgentId>({ value: 'agent-lead' });
const ARTIFACT = brandId<ArtifactId>({ value: 'artifact-plan' });
const QUESTION = brandId<OpenQuestionId>({ value: 'question-1' });
const WORKTREE = '/work/ledger-core';

const BRANCH_TABS: ReadonlyArray<BranchTab> = [
  'pr',
  'comments',
  'files',
  'commits',
  'checks',
  'work',
];

type SavedParams = {
  readonly place: Place;
  readonly rows?: Readonly<Record<string, string>>;
  readonly drawer?: unknown;
  readonly studio?: unknown;
};

const savedAsText = ({ place, rows, drawer = null, studio = null }: SavedParams): string =>
  JSON.stringify({
    workspaceId: 'ws-harborline',
    place,
    studio,
    focus: {
      ...EMPTY_FOCUS,
      drawer,
      ...(rows === undefined ? {} : { returnRows: rows }),
      runGroup: { groupKey: 'run-group-1', mountPath: WORKTREE },
    },
  });

const READ_BACK: (text: string) => Location = (text) => JSON.parse(text);

const TARGETS: ReadonlyArray<SessionTarget> = [
  { kind: 'artifact', artifactId: ARTIFACT },
  { kind: 'run', runId: 'run-1' },
  { kind: 'github-issue', issueNumber: 12 },
  { kind: 'diff', mountPath: WORKTREE, focus: null },
  { kind: 'diff', mountPath: WORKTREE, focus: null, page: 'history' },
  { kind: 'thread', threadId: 'thread-1' },
  { kind: 'question', questionId: QUESTION },
  ...BRANCH_TABS.map((tab): SessionTarget => ({
    kind: 'branch',
    mountPath: WORKTREE,
    tab,
    threadId: null,
    focus: null,
  })),
];

type Row = readonly [string, string];

const textOf = ({ place, ...rest }: SavedParams): string => savedAsText({ place, ...rest });

const PLACE_ROWS_SAVED: ReadonlyArray<Row> = [
  ['the board', textOf({ place: BOARD_PLACE })],
  ['the Overview', textOf({ place: sessionPlace({ sessionId: SESSION }) })],
  ...[...LENS_KINDS].map((lens): Row => [
    `the ${lens} page`,
    textOf({ place: sessionPlace({ sessionId: SESSION, lens }) }),
  ]),
  ...TARGETS.map((target): Row => [
    `a ${target.kind} target${target.kind === 'branch' ? ` on ${target.tab}` : ''}`,
    textOf({ place: sessionPlace({ sessionId: SESSION, lens: 'workflows', target }) }),
  ]),
  ...BRANCH_TABS.map((tab): Row => [
    `the branch page on ${tab}`,
    textOf({ place: branchPlace({ sessionId: SESSION, mountPath: WORKTREE, tab }) }),
  ]),
  [
    'the Lead page',
    textOf({ place: sessionPlace({ sessionId: SESSION, lens: 'workflows', agentId: LEAD }) }),
  ],
  [
    'an agent opened inside a run',
    textOf({
      place: sessionPlace({
        sessionId: SESSION,
        lens: 'workflows',
        agentId: LEAD,
        target: { kind: 'run', runId: 'run-1' },
      }),
    }),
  ],
  [
    'Runs filtered to Running',
    textOf({
      place: sessionPlace({ sessionId: SESSION, lens: 'workflows' }),
      rows: { [PLACE_ROWS.runsFilter]: 'running' },
    }),
  ],
  [
    'Changes on All files',
    textOf({
      place: sessionPlace({ sessionId: SESSION, lens: 'files' }),
      rows: { [PLACE_ROWS.changesMode]: 'all' },
    }),
  ],
  [
    'the Context page on its history',
    textOf({
      place: sessionPlace({ sessionId: SESSION, lens: 'context' }),
      rows: { [PLACE_ROWS.contextSection]: 'history' },
    }),
  ],
  [
    'the Overview with a Lead row',
    textOf({
      place: sessionPlace({ sessionId: SESSION }),
      rows: { [PLACE_ROWS.boardLead]: LEAD },
    }),
  ],
];

const DRAWERS_SAVED: ReadonlyArray<Row> = [
  ...Object.keys(DRAWER_KINDS).map((kind): Row => [
    `the ${kind} panel on the Overview`,
    textOf({
      place: sessionPlace({ sessionId: SESSION }),
      drawer: { kind, sessionId: SESSION, payload: null },
    }),
  ]),
  ...(['terminal', 'browser'] as const).map((kind): Row => [
    `the ${kind} dock with no session`,
    textOf({
      place: BOARD_PLACE,
      drawer: { kind, sessionId: null, payload: null },
    }),
  ]),
];

const STUDIOS_SAVED: ReadonlyArray<Row> = PREVIOUS_BUILD_BLOBS.studios.map((entry): Row => [
  `the ${entry.kind} page`,
  JSON.stringify(entry.blob),
]);

describe('rehearsal: the previous release opens every place this build saves', () => {
  it.each(PLACE_ROWS_SAVED)('opens %s', (_name, text) => {
    expect(opensInPreviousRelease({ location: READ_BACK(text) }), text).toBe(true);
  });

  it.each(DRAWERS_SAVED)('opens %s', (_name, text) => {
    expect(opensInPreviousRelease({ location: READ_BACK(text) }), text).toBe(true);
  });

  it.each(STUDIOS_SAVED)('opens %s', (_name, text) => {
    const blob: { readonly location: Location } = JSON.parse(text);
    expect(opensInPreviousRelease({ location: blob.location }), text).toBe(true);
  });

  it('would refuse a place kind and a studio the previous release never knew', () => {
    const future = READ_BACK(textOf({ place: BOARD_PLACE }));

    expect(
      opensInPreviousRelease({
        location: { ...future, place: JSON.parse('{"at":"lead-record"}') },
      }),
    ).toBe(false);
    expect(
      opensInPreviousRelease({
        location: { ...future, studio: JSON.parse('{"kind":"lead-record"}') },
      }),
    ).toBe(false);
    expect(
      opensInPreviousRelease({
        location: {
          ...future,
          place: JSON.parse(
            `{"at":"session","sessionId":"${SESSION}","view":{"lens":null,"agentId":null,"target":{"kind":"branch","tab":"lead-record"}}}`,
          ),
        },
      }),
    ).toBe(false);
  });
});
