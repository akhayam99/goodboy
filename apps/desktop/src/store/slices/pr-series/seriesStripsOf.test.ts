// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
} from '../../storyHarness';
import { aMountGithub } from '../github/testing/aMountGithub';
import { seriesStripsOf } from './seriesStripsOf';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

const WORKSPACE = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const PROJECT = aProject({ workspaceId: WORKSPACE.id, name: 'ledger-core' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Round ledger amounts' });
const SESSION_ID: SessionId = SESSION.id;
const SERIES_ID = brandId<PrSeriesId>({ value: 'series-ledger-rounding' });
const FIRST = brandId<MountId>({ value: 'mount-rounding-1' });
const SECOND = brandId<MountId>({ value: 'mount-rounding-2' });

type RequestParams = {
  readonly number: number;
  readonly state: PullRequestState['state'];
};

const requestAt = ({ number, state }: RequestParams): PullRequestState => ({
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

type PartParams = {
  readonly ordinal: number;
  readonly mountId: MountId | null;
};

const partAt = ({ ordinal, mountId }: PartParams): PrSeriesView['members'][number] => ({
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
  members: [partAt({ ordinal: 1, mountId: FIRST }), partAt({ ordinal: 2, mountId: SECOND })],
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
        pr: requestAt({ number: 21, state: first }),
      },
      [SECOND]: {
        ...aMountGithub({ mountId: SECOND, projectId: PROJECT.id }),
        pr: requestAt({ number: 23, state: 'open' }),
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

describe('seriesStripsOf', () => {
  it('reads each declared part from its request and adds the part that has no branch yet', () => {
    seed({ first: 'merged' });

    const [strip] = seriesStripsOf({ state: store.getState(), sessionId: SESSION_ID });

    expect(strip).toMatchObject({ name: 'ledger-rounding', total: 3, current: 2 });
    expect(strip?.parts.map((part) => [part.label, part.state])).toEqual([
      ['1', 'merged'],
      ['2', 'open'],
      ['3', 'planned'],
    ]);
  });

  it('puts the current part on the first one that is not merged or closed', () => {
    seed({ first: 'open' });

    const [strip] = seriesStripsOf({ state: store.getState(), sessionId: SESSION_ID });

    expect(strip?.current).toBe(1);
  });

  it('reads a series nobody declared as no strip', () => {
    store.setState({ prSeries: {} });

    expect(seriesStripsOf({ state: store.getState(), sessionId: SESSION_ID })).toEqual([]);
  });
});
