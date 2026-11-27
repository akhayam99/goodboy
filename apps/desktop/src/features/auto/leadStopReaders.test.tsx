import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NAMES } from '../../shared/utils/names';
import type { AutoPhase } from '@goodboy/db';
import type { Agent } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
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

const LEAD_WORDS: ReadonlyArray<string> = [
  NAMES.running,
  NAMES.needsYou,
  NAMES.needsApproval,
  NAMES.idle,
  NAMES.stopped,
  NAMES.done,
];

const CASES: ReadonlyArray<Case> = [
  { name: 'working', view: viewOf({ phase: 'waiting' }), word: 'Running' },
  {
    name: 'plan ready',
    view: aView({ phase: 'waiting', artifacts: [aPlanRow()] }),
    word: 'Needs approval',
  },
  { name: 'resting', view: viewOf({ phase: 'done' }), word: 'Idle' },
  { name: 'stopped', view: viewOf({ phase: 'stopped' }), word: 'Stopped' },
  { name: 'finished', view: viewOf({ phase: 'finished' }), word: 'Done' },
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
    ownSpendByAgentId: new Map(),
    openFoldIds: new Set(),
  }).leads[0]?.stateWord;

const renderHeader = ({ view }: ViewParams) => {
  useAppStore.setState({ autoTreeViews: { [FIXTURE_SESSION]: [view] } });
  return render(<LeadHeaderWord sessionId={FIXTURE_SESSION} rootAgentId={FIXTURE_ROOT} />);
};

describe('the five Lead words, one function, every reader', () => {
  it.each(CASES)('$name reads $word in the header, the row and the branch', ({ view, word }) => {
    renderHeader({ view });

    expect(LEAD_WORDS).toContain(word);
    expect(screen.getByText(word).textContent).toBe(word);
    expect(workRowWordOf({ view })).toBe(word);
    expect(branchBlockWordOf({ view })).toBe(word);
  });

  it('shows no header word for a Lead whose tree is not loaded', () => {
    useAppStore.setState({ autoTreeViews: {} });
    const { container } = render(
      <LeadHeaderWord sessionId={FIXTURE_SESSION} rootAgentId={FIXTURE_ROOT} />,
    );

    expect(container.textContent).toBe('');
  });
});
