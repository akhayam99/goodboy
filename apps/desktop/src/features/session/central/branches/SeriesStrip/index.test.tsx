// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  brandId,
  type MountId,
  type PrSeriesId,
  type PrSeriesMemberId,
  type PrSeriesView,
  type PullRequestState,
  type SessionId,
} from '@goodboy/types';
import { aProject, aSession, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { aMountGithub } from '../../../../../store/slices/github/testing/aMountGithub';
import { BranchList } from '../BranchList';
import { branchFactsOf } from '../branchFactsOf';
import { branchEntriesOf } from '../branchStoryOf';
import { aMountRow, aRequest } from '../testing/aMountRow';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

const WORKSPACE = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const PROJECT = aProject({ workspaceId: WORKSPACE.id, name: 'ledger-core' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Round ledger amounts' });
const SESSION_ID: SessionId = SESSION.id;
const SERIES_ID = brandId<PrSeriesId>({ value: 'series-ledger-rounding' });
const FIRST = brandId<MountId>({ value: 'mount-rounding-1' });
const SECOND = brandId<MountId>({ value: 'mount-rounding-2' });

const pullRequestOf = ({
  number,
  state,
}: {
  readonly number: number;
  readonly state: PullRequestState['state'];
}): PullRequestState => ({
  number,
  title: `Rounding part ${number}`,
  url: `https://github.com/harborline/ledger-core/pull/${number}`,
  state,
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: `ledger-rounding-${number}`,
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: TEST_NOW,
});

const memberOf = ({
  ordinal,
  mountId,
}: {
  readonly ordinal: number;
  readonly mountId: MountId | null;
}): PrSeriesView['members'][number] => ({
  id: brandId<PrSeriesMemberId>({ value: `member-${ordinal}` }),
  seriesId: SERIES_ID,
  mountId,
  branch: mountId === null ? null : `ledger-rounding-${ordinal}`,
  ordinal,
  label: String(ordinal),
  status: mountId === null ? 'planned' : 'active',
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
  request: null,
});

const SERIES: PrSeriesView = {
  id: SERIES_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT.id,
  name: 'ledger-rounding',
  workItemIdentifier: 'HBL-412',
  workItemUrl: null,
  plannedCount: 3,
  parentRequest: null,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
  members: [memberOf({ ordinal: 1, mountId: FIRST }), memberOf({ ordinal: 2, mountId: SECOND })],
};

let store: StoryStore;

const seed = ({ first }: { readonly first: PullRequestState['state'] }) => {
  store.setState({
    workspaces: [WORKSPACE],
    projects: [PROJECT],
    sessions: [SESSION],
    prSeries: { [SESSION_ID]: [SERIES] },
    mountGithub: {
      [FIRST]: {
        ...aMountGithub({ mountId: FIRST, projectId: PROJECT.id }),
        pr: pullRequestOf({ number: 21, state: first }),
      },
      [SECOND]: {
        ...aMountGithub({ mountId: SECOND, projectId: PROJECT.id }),
        pr: pullRequestOf({ number: 23, state: 'open' }),
      },
    },
  });
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('the Branches block of a series', () => {
  const entriesOf = () => {
    const row = {
      ...aMountRow({
        key: 'rounding-2',
        projectName: 'ledger-core',
        branch: 'ledger-rounding-2',
        request: aRequest({ provider: 'github', number: 23, checks: 'success' }),
      }),
      series: {
        seriesId: SERIES_ID,
        name: 'ledger-rounding',
        position: 2,
        plannedCount: 3,
        label: '2',
      },
    };
    const facts = branchFactsOf({
      rows: [row],
      fetchedAtByMountId: new Map(),
      behindByMountId: new Map(),
      liveCountByMountId: new Map(),
      now: Date.parse(TEST_NOW),
    });
    return branchEntriesOf({ facts, detailByMountId: new Map() }).live;
  };

  it('says "part 2 of 3" with the series name, and names the planned part with no branch', () => {
    seed({ first: 'merged' });

    render(<BranchList sessionId={SESSION_ID} entries={entriesOf()} />);

    screen.getByRole('group', { name: 'Series ledger-rounding, part 2 of 3' });
    screen.getByText('Part 2 of 3');
    screen.getByText('Part 3 of 3 is planned, no branch yet');
  });

  it('says the total once for a planned part whose label already holds it', () => {
    seed({ first: 'merged' });
    store.setState({
      prSeries: {
        [SESSION_ID]: [
          {
            ...SERIES,
            members: [
              ...SERIES.members,
              { ...memberOf({ ordinal: 3, mountId: null }), label: '3/3' },
            ],
          },
        ],
      },
    });

    render(<BranchList sessionId={SESSION_ID} entries={entriesOf()} />);

    screen.getByText('Part 3 of 3 is planned, no branch yet');
    expect(screen.queryByText(/3\/3/)).toBeNull();
  });

  it('says every part is done once all of them merged', () => {
    seed({ first: 'merged' });
    store.setState({
      prSeries: {
        [SESSION_ID]: [
          {
            ...SERIES,
            plannedCount: 2,
          },
        ],
      },
      mountGithub: {
        [FIRST]: {
          ...aMountGithub({ mountId: FIRST, projectId: PROJECT.id }),
          pr: pullRequestOf({ number: 21, state: 'merged' }),
        },
        [SECOND]: {
          ...aMountGithub({ mountId: SECOND, projectId: PROJECT.id }),
          pr: pullRequestOf({ number: 23, state: 'merged' }),
        },
      },
    });

    render(<BranchList sessionId={SESSION_ID} entries={entriesOf()} />);

    screen.getByRole('group', { name: 'Series ledger-rounding, all 2 parts done' });
  });

  it('draws no strip for a session without a series', () => {
    store.setState({ prSeries: {} });

    render(<BranchList sessionId={SESSION_ID} entries={entriesOf()} />);

    expect(document.querySelector('[data-series-strip]')).toBeNull();
  });
});
