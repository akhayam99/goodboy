// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../../chat/turn', async () =>
  (await import('../../../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../../../permissions/permissions', async () =>
  (await import('../../../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../../providers/providers', async () =>
  (await import('../../../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../../providers/routing', async () =>
  (await import('../../../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../../budget/budget', async () =>
  (await import('../../../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../../workflows/workflows', async () =>
  (await import('../../../../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../../worktree/worktree', async () =>
  (await import('../../../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../../../shared/lib/repo', async () =>
  (await import('../../../../../store/storyHarness')).repoModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type OpenQuestion,
  type OpenQuestionId,
} from '@goodboy/types';
import { aProject, aSession, anAgent } from '@goodboy/types/testing';
import {
  importStore,
  openStorySqlite,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { backOf } from '../../../../../store/slices/navigation/backOf';
import { captureLocation } from '../../../../../store/slices/navigation/captureLocation';
import { useOpenQuestions } from '../../../../context/components/QuestionsTab/useOpenQuestions';
import { sessionPlace } from '../../../../../store/slices/navigation/place';
import { openBranchWork } from '../../../openBranchWork';
import { aMountView } from '../../../testing/aMountView';
import { QuestionsPane } from './QuestionsPane';

const SESSION = aSession();
const AT = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });
const PAYMENTS = aProject({ name: 'payments-api' });
const NOTIFY = aProject({ name: 'notify-relay' });
const DUP = aMountView({
  key: 'dup',
  sessionId: SESSION.id,
  projectId: PAYMENTS.id,
  projectName: 'payments-api',
  branch: 'fix/duplicate-credit',
});
const RETRY = aMountView({
  key: 'retry',
  sessionId: SESSION.id,
  projectId: NOTIFY.id,
  projectName: 'notify-relay',
  branch: 'feat/retry-budget',
});

const NORTHWIND = aProject({ name: 'northwind-sync' });
const SYNC = aMountView({
  key: 'sync',
  sessionId: SESSION.id,
  projectId: NORTHWIND.id,
  projectName: 'northwind-sync',
  branch: 'feat/sync-window',
});
const AT_SYNC = anAgent({ sessionId: SESSION.id, name: 'Planner', mountId: SYNC.id });

const LEAD = anAgent({ sessionId: SESSION.id, name: 'Orchestrator' });
const LEAD_ON_DUP = anAgent({ sessionId: SESSION.id, parentAgentId: LEAD.id, mountId: DUP.id });
const LEAD_ON_RETRY = anAgent({ sessionId: SESSION.id, parentAgentId: LEAD.id, mountId: RETRY.id });
const AT_DUP = anAgent({ sessionId: SESSION.id, name: 'Implementer', mountId: DUP.id });
const AGENTS = [LEAD, LEAD_ON_DUP, LEAD_ON_RETRY, AT_DUP];

type QuestionParams = {
  readonly id: string;
  readonly text: string;
  readonly askerId?: AgentId;
  readonly isAnswered?: boolean;
};

const questionOf = ({ id, text, askerId, isAnswered = false }: QuestionParams): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: id }),
  sessionId: SESSION.id,
  ...(askerId === undefined ? {} : { createdByAgentId: askerId }),
  text,
  suggestedAnswers: ['Yes', 'No'],
  isBlocking: false,
  userAnswer: isAnswered ? 'Yes' : null,
  status: isAnswered ? 'answered' : 'open',
  createdAt: AT,
  ...(isAnswered ? { answeredAt: AT } : {}),
});

const SHARED = questionOf({
  id: 'shared',
  text: 'Should the limit apply per endpoint?',
  askerId: LEAD.id,
});
const ON_DUP = questionOf({
  id: 'on-dup',
  text: 'Which queue retries run on?',
  askerId: AT_DUP.id,
});
const DONE = questionOf({
  id: 'done',
  text: 'Keep the old table for a month?',
  askerId: AT_DUP.id,
  isAnswered: true,
});
const ON_SYNC = questionOf({
  id: 'on-sync',
  text: 'Widen the sync window?',
  askerId: AT_SYNC.id,
});
const LOOSE = questionOf({ id: 'loose', text: 'Cover Northwind in the guide?' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
});

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  act(() => useOpenQuestions.setState({ staged: [], pendingUndo: null }));
  useAppStore.setState({
    currentSessionId: SESSION.id,
    sessions: [SESSION],
    projects: [PAYMENTS, NOTIFY],
    sessionMounts: { [SESSION.id]: [DUP, RETRY] },
    sessionPhaseRuns: { [SESSION.id]: AGENTS },
    sessionOpenQuestions: { [SESSION.id]: [SHARED, ON_DUP, LOOSE] },
    sessionAnsweredQuestions: { [SESSION.id]: [DONE] },
    groupBySession: { [SESSION.id]: 'branch' },
    loadSessionOpenQuestions: vi.fn(async () => undefined),
    loadSessionAnsweredQuestions: vi.fn(async () => undefined),
  });
});

afterEach(cleanup);

const rowsTitled = (title: string) =>
  screen.getAllByRole('button', { name: new RegExp(`^${title}`) });

describe('Questions by branch', () => {
  it('draws a question of two branches in both, each copy saying where else it is', async () => {
    render(<QuestionsPane session={SESSION} />);

    await waitFor(() =>
      expect(rowsTitled('Should the limit apply per endpoint\\?')).toHaveLength(2),
    );
    expect(screen.getAllByTestId('run-also-on')).toHaveLength(2);
    screen.getByRole('heading', { name: 'No branch' });
  });

  it('folds the answered ones of a branch behind their count', async () => {
    render(<QuestionsPane session={SESSION} />);

    await screen.findByRole('button', { name: '1 answered' });
    expect(screen.queryByText('Keep the old table for a month?')).toBeNull();
  });

  it('moves both copies when the question is staged from one of them', async () => {
    render(<QuestionsPane session={SESSION} />);
    await waitFor(() =>
      expect(rowsTitled('Should the limit apply per endpoint\\?')).toHaveLength(2),
    );

    act(() => useOpenQuestions.getState().stageAnswer(SHARED.id));

    await waitFor(() =>
      expect(rowsTitled('Should the limit apply per endpoint\\?')).toHaveLength(1),
    );
    screen.getByRole('button', { name: '2 answered' });
  });

  it('marks the open question in its first group only', async () => {
    useAppStore.setState({
      drawer: {
        kind: 'question',
        sessionId: SESSION.id,
        payload: { questionId: SHARED.id },
      },
    });
    render(<QuestionsPane session={SESSION} />);

    await waitFor(() =>
      expect(rowsTitled('Should the limit apply per endpoint\\?')).toHaveLength(2),
    );
    const current = rowsTitled('Should the limit apply per endpoint\\?').filter(
      (row) => row.getAttribute('aria-current') === 'true',
    );
    expect(current).toHaveLength(1);
  });

  it('reads as it does today with one work branch', async () => {
    useAppStore.setState({
      sessionOpenQuestions: { [SESSION.id]: [ON_DUP] },
      sessionAnsweredQuestions: { [SESSION.id]: [DONE] },
    });
    render(<QuestionsPane session={SESSION} />);

    await screen.findByRole('heading', { name: 'Needs you' });
    expect(screen.queryByRole('tablist', { name: 'Group by' })).toBeNull();
    screen.getByRole('heading', { name: 'Answered' });
  });

  it('goes back to the state groups from the switch', async () => {
    render(<QuestionsPane session={SESSION} />);
    await screen.findByRole('tab', { name: 'By state' });

    fireEvent.click(screen.getByRole('tab', { name: 'By state' }));

    await screen.findByRole('heading', { name: 'Needs you' });
    expect(useAppStore.getState().groupBySession[SESSION.id]).toBe('state');
  });

  it('sends the questions of a detached mount to No branch', async () => {
    useAppStore.setState({
      projects: [PAYMENTS, NOTIFY, NORTHWIND],
      sessionMounts: { [SESSION.id]: [{ ...DUP, isAttached: false }, RETRY, SYNC] },
      sessionPhaseRuns: { [SESSION.id]: [...AGENTS, AT_SYNC] },
      sessionOpenQuestions: { [SESSION.id]: [SHARED, ON_DUP, ON_SYNC] },
    });
    render(<QuestionsPane session={SESSION} />);

    await screen.findByRole('heading', { name: 'No branch' });
    const section = screen.getByRole('heading', { name: 'No branch' }).closest('li');
    if (section === null) {
      throw new Error('missing group');
    }
    within(section).getByText('Which queue retries run on?');
  });

  it('opens the group named by the address with its answered rows unfolded', async () => {
    act(() =>
      openBranchWork({
        sessionId: SESSION.id,
        lens: 'questions',
        groupKey: `mount:${DUP.id}`,
        mountPath: DUP.worktreePath,
      }),
    );
    render(<QuestionsPane session={SESSION} />);

    await screen.findByText('Keep the old table for a month?');
    expect(useAppStore.getState().groupBySession[SESSION.id]).toBe('branch');
  });

  it('keeps the grouping you chose when a branch sends you here', () => {
    useAppStore.setState({ groupBySession: { [SESSION.id]: 'state' } });

    act(() =>
      openBranchWork({
        sessionId: SESSION.id,
        lens: 'questions',
        groupKey: `mount:${DUP.id}`,
        mountPath: DUP.worktreePath,
      }),
    );

    expect(useAppStore.getState().groupBySession[SESSION.id]).toBe('state');
  });

  it('reveals another branch from Also on without opening the question drawer', async () => {
    render(<QuestionsPane session={SESSION} />);
    const chips = await screen.findAllByTestId('run-also-on');
    const chip = chips[0];
    if (chip === undefined) {
      throw new Error('missing Also on chip');
    }
    fireEvent.click(chip.querySelector('span') ?? chip);

    expect(useAppStore.getState().drawer).toBeNull();
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('data-row-key')).toBe(
        `mount:${RETRY.id}/${SHARED.id}`,
      ),
    );
  });

  it('unfolds and focuses answered only arrivals with one named branch in state mode', async () => {
    useAppStore.setState({
      sessionOpenQuestions: { [SESSION.id]: [] },
      sessionAnsweredQuestions: { [SESSION.id]: [DONE] },
    });
    act(() =>
      openBranchWork({
        sessionId: SESSION.id,
        lens: 'questions',
        groupKey: `mount:${DUP.id}`,
        mountPath: DUP.worktreePath,
      }),
    );
    render(<QuestionsPane session={SESSION} />);

    await screen.findByText(DONE.text);
    expect(screen.queryByRole('tablist', { name: 'Group by' })).toBeNull();
    await waitFor(() => expect(document.activeElement?.getAttribute('data-row-key')).toBe(DONE.id));
  });

  it('goes Back from the questions page to the branch it came from', () => {
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId: SESSION.id }) });

    act(() =>
      openBranchWork({
        sessionId: SESSION.id,
        lens: 'questions',
        groupKey: `mount:${DUP.id}`,
        mountPath: DUP.worktreePath,
      }),
    );

    const state = useAppStore.getState();
    const here = captureLocation({ state }).place;
    expect(backOf({ state, place: here })?.label).toBe('Back to branch');
  });
});
