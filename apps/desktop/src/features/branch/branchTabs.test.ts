// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiffComment, PullRequestStateKind, SessionId } from '@goodboy/types';

const flags = vi.hoisted(() => ({ isPrAvailable: true }));

vi.mock('./branchTabs', async (importOriginal) => {
  const original = await importOriginal<typeof import('./branchTabs')>();
  return {
    ...original,
    resolveBranchTab: (params: Parameters<typeof original.resolveBranchTab>[0]) =>
      original.resolveBranchTab({
        ...params,
        isAvailable: (tab) => (tab === 'pr' ? flags.isPrAvailable : true),
      }),
  };
});

import { sceneClock } from '../../app/components/MockScene/sceneClock';
import { useAppStore } from '../../store';
import type { AppState } from '../../store/types';
import { canonicalLocation } from '../../store/slices/navigation/canonicalLocation';
import { locationKey } from '../../store/slices/navigation/locationKey';
import { branchPlace, sessionPlace } from '../../store/slices/navigation/place';
import type { BranchTab, Place } from '../../store/slices/navigation/types';
import { SHORTCUTS } from '../../shared/keyboard/registry';
import type { PullRequestPresentationState } from '../../shared/pullRequestPresentation';
import {
  BRANCH_TAB_REGISTRY,
  branchTabsOf,
  isBranchReadOnly,
  resolveBranchTab,
  type BranchTabRegistry,
} from './branchTabs';

const SESSION = 'session-ledger-core' as SessionId;

const clock = sceneClock({ anchor: '2026-10-09T10:00:00.000Z' });

const withoutPr: BranchTabRegistry = {
  ...BRANCH_TAB_REGISTRY,
  pr: { ...BRANCH_TAB_REGISTRY.pr, isAvailable: false },
};

const NOTE: DiffComment = {
  id: 'note-1',
  sessionId: SESSION,
  filePath: 'src/ledger/postCredit.ts',
  body: 'Guard the retry.',
  status: 'open',
  createdAt: clock.iso({ at: '2026-10-09T10:00:00.000Z' }),
  authorKind: 'user',
};

const PR_STATES: ReadonlyArray<PullRequestStateKind> = [
  'draft',
  'open',
  'approved',
  'queued',
  'merged',
  'closed',
];

const ALL_FIVE: ReadonlyArray<BranchTab> = ['pr', 'comments', 'files', 'commits', 'checks'];

const tabIds = (state: PullRequestPresentationState, hasComments: boolean) =>
  branchTabsOf({ state, hasComments }).map((tab) => tab.id);

const stateOf = ({
  pr,
  hasNote,
}: {
  readonly pr: PullRequestStateKind | null;
  readonly hasNote: boolean;
}): AppState => ({
  ...useAppStore.getInitialState(),
  ...(hasNote && { diffComments: { [SESSION]: [NOTE] } }),
  ...(pr !== null && {
    sessionGithub: {
      [SESSION]: {
        pr: {
          number: 318,
          title: 'Settle the duplicate credit',
          url: 'https://github.com/harborline/payments-api/pull/318',
          state: pr,
          mergeable: true,
          checks: 'success',
          baseBranch: 'main',
          headBranch: 'hl/fix-duplicate-credit',
          isDraft: pr === 'draft',
          reviewDecision: null,
          body: '',
          updatedAt: '2026-10-09T10:00:00.000Z',
        },
        linkedIssues: [],
        fetchedAt: null,
        failedAt: null,
        loading: false,
        error: null,
        detail: null,
        detailFetchedAt: null,
        detailLoading: false,
        detailError: null,
      },
    },
  }),
});

const tabOf = (place: Place): BranchTab | null =>
  place.at === 'session' && place.view.target?.kind === 'branch' ? place.view.target.tab : null;

type Case = {
  readonly pr: PullRequestStateKind | null;
  readonly hasNote: boolean;
};

const CASES: ReadonlyArray<Case> = [
  { pr: null, hasNote: false },
  { pr: null, hasNote: true },
  ...PR_STATES.map((pr): Case => ({ pr, hasNote: false })),
];

const landed = ({ request, ...scope }: Case & { readonly request: Place }): BranchTab | null =>
  tabOf(canonicalLocation({ state: stateOf(scope), request }).place);

beforeEach(() => {
  flags.isPrAvailable = true;
});

describe('the Branch sections by state', () => {
  it('gives Overview, Files and Commits with no pull request and no comment', () => {
    expect(tabIds('none', false)).toEqual(['pr', 'files', 'commits']);
  });

  it('adds Comments with no pull request once one local note exists', () => {
    expect(tabIds('none', true)).toEqual(['pr', 'comments', 'files', 'commits']);
  });

  it.each(PR_STATES)('gives all five sections in the %s state', (state) => {
    expect(tabIds(state, false)).toEqual(ALL_FIVE);
    expect(tabIds(state, true)).toEqual(ALL_FIVE);
  });

  it('never shows Checks without a pull request', () => {
    expect(tabIds('none', true)).not.toContain('checks');
    expect(tabIds('none', false)).not.toContain('checks');
  });

  it('labels the first section Pull request in every state', () => {
    for (const { pr, hasNote } of CASES) {
      const scope = { state: pr ?? 'none', hasComments: hasNote } as const;
      expect(branchTabsOf(scope)[0]?.label).toBe('Pull request');
    }
  });

  it('reads Merged and Closed as read only', () => {
    expect(isBranchReadOnly({ state: 'merged' })).toBe(true);
    expect(isBranchReadOnly({ state: 'closed' })).toBe(true);
    for (const state of ['none', 'draft', 'open', 'approved', 'queued'] as const) {
      expect(isBranchReadOnly({ state })).toBe(false);
    }
  });

  it('leaves the pull request section out of a registry that holds it back', () => {
    expect(
      branchTabsOf({ state: 'open', hasComments: false }, withoutPr).map((tab) => tab.id),
    ).toEqual(['comments', 'files', 'commits', 'checks']);
  });

  it('names each section by the label of its shortcut, Overview aside', () => {
    for (const tab of Object.values(BRANCH_TAB_REGISTRY)) {
      if (tab.shortcut !== null && tab.id !== 'pr') {
        expect(SHORTCUTS[tab.shortcut].label).toBe(tab.label);
      }
    }
    expect(BRANCH_TAB_REGISTRY.pr.shortcut).toBe('lens.pr');
  });

  it('prints each section as the last segment of the Branch address', () => {
    for (const tab of Object.values(BRANCH_TAB_REGISTRY)) {
      expect(locationKey({ place: branchPlace({ sessionId: SESSION, tab: tab.id }) })).toBe(
        `s/${SESSION}/branch/${tab.address}`,
      );
    }
  });
});

describe('the door resolver', () => {
  const EXPECTED: Readonly<Record<BranchTab, Readonly<Record<string, BranchTab>>>> = {
    pr: { 'none-plain': 'pr', 'none-note': 'pr', pr: 'pr' },
    comments: { 'none-plain': 'files', 'none-note': 'comments', pr: 'comments' },
    files: { 'none-plain': 'files', 'none-note': 'files', pr: 'files' },
    commits: { 'none-plain': 'commits', 'none-note': 'commits', pr: 'commits' },
    checks: { 'none-plain': 'pr', 'none-note': 'pr', pr: 'checks' },
  };

  const keyOf = ({ pr, hasNote }: Case): string => {
    if (pr !== null) {
      return 'pr';
    }
    return hasNote ? 'none-note' : 'none-plain';
  };

  it.each(ALL_FIVE)('lands a %s door where the table says, in every state', (tab) => {
    for (const scope of CASES) {
      const landing = landed({ ...scope, request: branchPlace({ sessionId: SESSION, tab }) });
      expect(landing, `${tab} with ${JSON.stringify(scope)}`).toBe(EXPECTED[tab][keyOf(scope)]);
    }
  });

  it('keeps the thread and the focus a door carries', () => {
    const request = branchPlace({ sessionId: SESSION, tab: 'comments', threadId: 'thread-1' });
    const place = canonicalLocation({
      state: stateOf({ pr: 'open', hasNote: false }),
      request,
    }).place;
    expect(place.at === 'session' ? place.view.target : null).toMatchObject({
      kind: 'branch',
      tab: 'comments',
      threadId: 'thread-1',
    });
  });

  it('lands the Comments door of a branch with no pull request on Files, with a note on Comments', () => {
    expect(
      landed({
        pr: null,
        hasNote: false,
        request: branchPlace({ sessionId: SESSION, tab: 'comments' }),
      }),
    ).toBe('files');
    expect(
      landed({
        pr: null,
        hasNote: true,
        request: branchPlace({ sessionId: SESSION, tab: 'comments' }),
      }),
    ).toBe('comments');
  });

  it('lands the Checks door with no pull request on Overview', () => {
    expect(
      landed({
        pr: null,
        hasNote: true,
        request: branchPlace({ sessionId: SESSION, tab: 'checks' }),
      }),
    ).toBe('pr');
  });

  it('lands the former lenses on the section the table says', () => {
    const lens = (name: 'review' | 'pr') => sessionPlace({ sessionId: SESSION, lens: name });
    for (const scope of CASES) {
      expect(landed({ ...scope, request: lens('pr') })).toBe('pr');
      expect(landed({ ...scope, request: lens('review') })).toBe('pr');
    }
  });

  it('resolves a section straight from a scope', () => {
    expect(
      resolveBranchTab({ tab: 'comments', scope: { state: 'none', hasComments: false } }),
    ).toBe('files');
    expect(resolveBranchTab({ tab: 'checks', scope: { state: 'none', hasComments: true } })).toBe(
      'pr',
    );
    expect(
      resolveBranchTab({ tab: 'checks', scope: { state: 'merged', hasComments: false } }),
    ).toBe('checks');
  });
});

describe('the pull request section while it is held back', () => {
  beforeEach(() => {
    flags.isPrAvailable = false;
  });

  it('lands a pr address on Comments with a pull request, on Files without', () => {
    expect(
      landed({
        pr: 'open',
        hasNote: false,
        request: branchPlace({ sessionId: SESSION, tab: 'pr' }),
      }),
    ).toBe('comments');
    expect(
      landed({ pr: null, hasNote: false, request: branchPlace({ sessionId: SESSION, tab: 'pr' }) }),
    ).toBe('files');
  });

  it('lands the former pull request lens on Comments, or Files while writing a review', () => {
    expect(
      landed({
        pr: 'open',
        hasNote: false,
        request: sessionPlace({ sessionId: SESSION, lens: 'pr' }),
      }),
    ).toBe('comments');
  });
});
