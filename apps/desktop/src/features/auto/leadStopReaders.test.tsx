import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LEAD_STOP_WORDS } from '@goodboy/core/auto';
import type { AutoPhase } from '@goodboy/db';
import type { Agent } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { SETTING_WORK_ENABLED } from '../../shared/lib/workSetting';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { branchLeadsOf } from '../session/branchLeadsOf';
import { LeadHeaderWord } from '../session/components/LeadPage/LeadHeaderWord';
import { sessionRunsOf } from '../session/sessionRunsOf';
import { railRowsOf } from './chat/railRowsOf';
import { aPlanRow, aView, FIXTURE_ROOT, FIXTURE_SESSION } from './testing/autoViewFixtures';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

type Case = Readonly<{
  name: string;
  view: AutoTreeView;
  word: string;
}>;

type PhaseParams = {
  readonly phase: AutoPhase;
};

const viewOf = ({ phase }: PhaseParams): AutoTreeView => aView({ phase });

const CASES: ReadonlyArray<Case> = [
  { name: 'working', view: viewOf({ phase: 'waiting' }), word: 'Working' },
  {
    name: 'plan ready',
    view: aView({ phase: 'waiting', artifacts: [aPlanRow()] }),
    word: 'Waits for you',
  },
  { name: 'resting', view: viewOf({ phase: 'done' }), word: 'Resting' },
  { name: 'stopped', view: viewOf({ phase: 'stopped' }), word: 'Stopped' },
  { name: 'finished', view: viewOf({ phase: 'finished' }), word: 'Finished' },
];

const ROOT: Agent = anAgent({
  id: FIXTURE_ROOT,
  sessionId: FIXTURE_SESSION,
  kind: 'auto',
  name: 'Stop retried webhooks posting a second credit',
  status: 'completed',
});

type ViewParams = {
  readonly view: AutoTreeView;
};

const runsOf = ({ view }: ViewParams) =>
  sessionRunsOf({
    attachedRuns: [],
    agents: [ROOT],
    kindOverride: {},
    autoViews: [view],
    orchestrating: {},
    questions: [],
    rootTurns: {},
    turnByAgentId: new Map(),
    revisingStarts: {},
    mounts: [],
    projects: [],
    isWork: true,
  });

const workRowWordOf = ({ view }: ViewParams): string | undefined =>
  runsOf({ view }).find((run) => run.kind === 'auto')?.stateWord;

const branchBlockWordOf = ({ view }: ViewParams): string | undefined =>
  branchLeadsOf({
    group: {
      key: 'none',
      head: { kind: 'none' },
      runs: runsOf({ view }),
      counts: { needsYou: 0, running: 0, finished: 0 },
      isGone: false,
    },
    mountId: null,
    mounts: [],
    views: [view],
    agents: [ROOT],
    spendByAgentId: new Map(),
    openFoldIds: new Set(),
  }).leads[0]?.stateWord;

type RootParams = ViewParams & {
  readonly isWork: boolean;
};

const treeRootOf = ({ view, isWork }: RootParams) =>
  railRowsOf({
    view,
    agents: [],
    rootRouting: { provider: null, model: null, effort: null },
    isWork,
  })[0];

type WorldParams = ViewParams & {
  readonly isWorkOn: boolean;
};

const renderHeader = ({ view, isWorkOn }: WorldParams) => {
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, [SETTING_WORK_ENABLED]: String(isWorkOn) },
    autoTreeViews: { [FIXTURE_SESSION]: [view] },
  });
  return render(<LeadHeaderWord sessionId={FIXTURE_SESSION} rootAgentId={FIXTURE_ROOT} />);
};

describe('the five Lead words, one function, every reader', () => {
  it.each(CASES)(
    '$name reads $word in the header, the row, the branch and the tree',
    ({ view, word }) => {
      renderHeader({ view, isWorkOn: true });

      expect(Object.values(LEAD_STOP_WORDS)).toContain(word);
      expect(screen.getByText(word).textContent).toBe(word);
      expect(workRowWordOf({ view })).toBe(word);
      expect(branchBlockWordOf({ view })).toBe(word);
      expect(treeRootOf({ view, isWork: true })?.word).toBe(word);
    },
  );

  it('keeps the Auto words with Work off and shows no header word', () => {
    const view = viewOf({ phase: 'done' });
    const { container } = renderHeader({ view, isWorkOn: false });

    expect(container.textContent).toBe('');
    expect(treeRootOf({ view, isWork: false })).toMatchObject({ label: 'Auto', word: 'Idle' });
  });
});
