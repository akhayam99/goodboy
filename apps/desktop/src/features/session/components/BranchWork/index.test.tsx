// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../chat/turn', async () =>
  (await import('../../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../../permissions/permissions', async () =>
  (await import('../../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../providers/providers', async () =>
  (await import('../../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../providers/routing', async () =>
  (await import('../../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../budget/budget', async () =>
  (await import('../../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../workflows/workflows', async () =>
  (await import('../../../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../worktree/worktree', async () =>
  (await import('../../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../../shared/lib/repo', async () =>
  (await import('../../../../store/storyHarness')).repoModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  brandId,
  type ArtifactId,
  type IsoDateTime,
  type MountId,
  type OpenQuestion,
  type OpenQuestionId,
  type PlanWithCount,
  type Session,
} from '@goodboy/types';
import { aProject, aSession, anAgent } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import { branchTabFactsOf } from '../../../branch/branchTabFactsOf';
import { stackKey } from '../../../../store/slices/navigation/currentStack';
import { agentPlace, branchPlace } from '../../../../store/slices/navigation/place';
import {
  importStore,
  openStorySqlite,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { useOpenQuestions } from '../../../context/components/QuestionsTab/useOpenQuestions';
import { branchWorkTabRegistration } from '../../branchWorkTabRegistration';
import { useSessionRuns } from '../../hooks/useSessionRuns';
import { aMountView } from '../../testing/aMountView';
import { QuestionsPane } from '../SessionWorkspace/parts/QuestionsPane';
import { RunsGrid } from '../SessionWorkspace/parts/RunsGrid';

const SESSION = aSession();
const AT = brandId<IsoDateTime>({ value: '2026-11-07T10:00:00.000Z' });
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

const LEAD = anAgent({ sessionId: SESSION.id, name: 'Orchestrator' });
const LEAD_ON_DUP = anAgent({ sessionId: SESSION.id, parentAgentId: LEAD.id, mountId: DUP.id });
const LEAD_ON_RETRY = anAgent({ sessionId: SESSION.id, parentAgentId: LEAD.id, mountId: RETRY.id });
const AT_DUP = anAgent({ sessionId: SESSION.id, name: 'Implementer', mountId: DUP.id });
const AT_DUP_TOO = anAgent({ sessionId: SESSION.id, name: 'Scout', mountId: DUP.id });
const AGENTS = [LEAD, LEAD_ON_DUP, LEAD_ON_RETRY, AT_DUP, AT_DUP_TOO];

type QuestionParams = {
  readonly id: string;
  readonly askerId: OpenQuestion['createdByAgentId'];
  readonly isAnswered?: boolean;
};

const questionOf = ({ id, askerId, isAnswered = false }: QuestionParams): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: id }),
  sessionId: SESSION.id,
  ...(askerId === undefined ? {} : { createdByAgentId: askerId }),
  text: `Question ${id}`,
  suggestedAnswers: ['Yes', 'No'],
  isBlocking: false,
  userAnswer: isAnswered ? 'Yes' : null,
  status: isAnswered ? 'answered' : 'open',
  createdAt: AT,
  ...(isAnswered ? { answeredAt: AT } : {}),
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
});

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  useOpenQuestions.setState({ staged: [], pendingUndo: null });
  useAppStore.setState({
    currentSessionId: SESSION.id,
    sessions: [SESSION],
    projects: [PAYMENTS, NOTIFY],
    sessionMounts: { [SESSION.id]: [DUP, RETRY] },
    sessionPhaseRuns: { [SESSION.id]: AGENTS },
    sessionOpenQuestions: {
      [SESSION.id]: [
        questionOf({ id: 'shared', askerId: LEAD.id }),
        questionOf({ id: 'on-dup', askerId: AT_DUP.id }),
      ],
    },
    sessionAnsweredQuestions: {
      [SESSION.id]: [questionOf({ id: 'done', askerId: AT_DUP.id, isAnswered: true })],
    },
    sessionArtifacts: { [SESSION.id]: [] },
    sessionPlans: { [SESSION.id]: [] },
    groupBySession: { [SESSION.id]: 'branch' },
    loadSessionOpenQuestions: vi.fn(async () => undefined),
    loadSessionAnsweredQuestions: vi.fn(async () => undefined),
  });
});

afterEach(cleanup);

type WorkProps = {
  readonly session: Session;
  readonly mountId: MountId;
  readonly mountPath: string | null;
};

const WorkTab = ({ session, mountId, mountPath }: WorkProps) => {
  const work = branchWorkTabRegistration.useWork({ session, mountId, mountPath });
  return <>{branchWorkTabRegistration.render({ session, work })}</>;
};

const WorkBadge = ({ session, mountId, mountPath }: WorkProps) => {
  const work = branchWorkTabRegistration.useWork({ session, mountId, mountPath });
  const fact = branchTabFactsOf({
    pullRequestState: 'none',
    commentsNeedYou: 0,
    commentsOpen: 0,
    files: null,
    diff: null,
    commits: null,
    notPushed: null,
    checks: null,
    checksUnreadReason: null,
    work: work.counts,
  }).work;
  return (
    <output data-work-badge={fact.tone ?? 'faint'} title={fact.tooltip ?? ''}>
      {fact.text}
    </output>
  );
};

type RunsProps = {
  readonly session: Session;
};

const SessionRuns = ({ session }: RunsProps) => {
  const runs = useSessionRuns({ session });
  return <RunsGrid session={session} runs={runs} />;
};

type CountParams = {
  readonly heading: HTMLElement;
};

const countBeside = ({ heading }: CountParams): string =>
  heading.closest('li')?.querySelector('[data-list-grid-count]')?.textContent ?? '1';

const sessionPageCounts = async (): Promise<ReadonlyArray<string>> => {
  render(
    <ToastProvider>
      <SessionRuns session={SESSION} />
      <QuestionsPane session={SESSION} />
    </ToastProvider>,
  );
  const groups = await screen.findAllByRole('heading', { level: 2, name: DUP.branch });
  const counts = groups.map((heading) => countBeside({ heading }));
  cleanup();
  return counts;
};

describe('the Work tab of a branch', () => {
  it('counts its runs and questions as the session pages count the group of that branch', async () => {
    const [pageRuns, pageQuestions] = await sessionPageCounts();

    render(
      <ToastProvider>
        <WorkTab session={SESSION} mountId={DUP.id} mountPath={DUP.worktreePath} />
      </ToastProvider>,
    );

    const runs = await screen.findByRole('heading', { level: 2, name: 'Runs' });
    const questions = screen.getByRole('heading', { level: 2, name: 'Questions' });
    expect(countBeside({ heading: runs })).toBe(pageRuns);
    expect(countBeside({ heading: questions })).toBe(pageQuestions);
    expect(pageQuestions).toBe('3');
  });

  it('colors the badge for a run that needs you, as the Runs header says, with nothing else waiting', async () => {
    const failed = anAgent({
      sessionId: SESSION.id,
      name: 'Debugger',
      mountId: DUP.id,
      status: 'failed',
    });
    useAppStore.setState({
      sessionPhaseRuns: { [SESSION.id]: [...AGENTS, failed] },
      sessionOpenQuestions: { [SESSION.id]: [] },
      sessionAnsweredQuestions: { [SESSION.id]: [] },
    });

    render(
      <ToastProvider>
        <WorkTab session={SESSION} mountId={DUP.id} mountPath={DUP.worktreePath} />
        <WorkBadge session={SESSION} mountId={DUP.id} mountPath={DUP.worktreePath} />
      </ToastProvider>,
    );

    const runs = await screen.findByRole('heading', { level: 2, name: 'Runs' });
    expect(runs.closest('li')?.textContent).toMatch(/1 needs you/);
    const badge = screen.getByRole('status');
    expect(badge.getAttribute('data-work-badge')).toBe('warning');
    expect(badge.textContent).toBe('1');
    expect(badge.getAttribute('title')).toMatch(/^1 run needs you/);
  });

  it('counts a run and the question it waits on as one thing that needs you', async () => {
    useAppStore.setState({
      sessionOpenQuestions: {
        [SESSION.id]: [{ ...questionOf({ id: 'on-dup', askerId: AT_DUP.id }), isBlocking: true }],
      },
      sessionAnsweredQuestions: { [SESSION.id]: [] },
    });

    render(
      <ToastProvider>
        <WorkTab session={SESSION} mountId={DUP.id} mountPath={DUP.worktreePath} />
        <WorkBadge session={SESSION} mountId={DUP.id} mountPath={DUP.worktreePath} />
      </ToastProvider>,
    );

    const runs = await screen.findByRole('heading', { level: 2, name: 'Runs' });
    expect(runs.closest('li')?.textContent).toMatch(/1 needs you/);
    const questions = screen.getByRole('heading', { level: 2, name: 'Questions' });
    expect(questions.closest('li')?.textContent).toMatch(/1 waiting/);
    const badge = screen.getByRole('status');
    expect(badge.getAttribute('data-work-badge')).toBe('warning');
    expect(badge.textContent).toBe('1');
    expect(badge.getAttribute('title')).toMatch(/^1 run needs you · /);
    expect(badge.getAttribute('title')).not.toMatch(/waits? for you/);
  });

  it('draws no Open branch, since it already is the branch', async () => {
    render(
      <ToastProvider>
        <WorkTab session={SESSION} mountId={DUP.id} mountPath={DUP.worktreePath} />
      </ToastProvider>,
    );

    await screen.findByRole('heading', { level: 2, name: 'Questions' });
    expect(screen.queryByRole('button', { name: 'Open branch' })).toBeNull();
    screen.getByRole('button', { name: 'All runs' });
    screen.getByRole('button', { name: 'All questions' });
  });

  it('hides Also on for a branch the Branch page does not know', async () => {
    render(
      <ToastProvider>
        <WorkTab session={SESSION} mountId={DUP.id} mountPath={DUP.worktreePath} />
      </ToastProvider>,
    );

    await screen.findByRole('heading', { level: 2, name: 'Questions' });
    expect(screen.queryAllByTestId('run-also-on')).toHaveLength(0);
  });

  it('draws Also on for a branch the Branch page knows and opens its Work tab', async () => {
    useAppStore.setState({
      sessionProjectMounts: {
        [SESSION.id]: [
          {
            mountId: RETRY.id,
            sessionId: SESSION.id,
            projectId: NOTIFY.id,
            mountName: 'notify-relay',
            worktreePath: '/work/notify-relay',
            lastWorktreePath: '/work/notify-relay',
            repoRoot: '/work/notify-relay',
            branch: RETRY.branch,
            baseBranch: null,
            parallelIndex: 1,
            isAttached: true,
            diskState: 'present',
            revision: 0,
          },
        ],
      },
    });

    render(
      <ToastProvider>
        <WorkTab session={SESSION} mountId={DUP.id} mountPath={DUP.worktreePath} />
      </ToastProvider>,
    );

    await screen.findByRole('heading', { level: 2, name: 'Questions' });
    expect(screen.getAllByTestId('run-also-on').length).toBeGreaterThan(0);
  });
});

type PlanParams = {
  readonly id: string;
  readonly title: string;
  readonly status: PlanWithCount['status'];
};

const planOf = ({ id, title, status }: PlanParams): PlanWithCount => ({
  id: brandId<ArtifactId>({ value: id }),
  sessionId: SESSION.id,
  agentId: AT_DUP.id,
  title,
  bodyMd: '## Goal',
  status,
  createdAt: AT,
  updatedAt: AT,
  consumptionCount: status === 'consumed' ? 1 : 0,
});

const renderWork = () =>
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <WorkTab session={SESSION} mountId={DUP.id} mountPath={DUP.worktreePath} />
      </ObjectMenuProvider>
    </ToastProvider>,
  );

const topPlaceOf = () => {
  const state = useAppStore.getState();
  const stack = state.navigation[stackKey(state)];
  return stack?.entries[stack.index]?.place;
};

describe('returning to the Work tab of a branch', () => {
  beforeEach(() => {
    useAppStore.setState({
      sessionPlans: {
        [SESSION.id]: [
          planOf({ id: 'plan-live', title: 'Credit notes', status: 'active' }),
          planOf({ id: 'plan-used', title: 'Old credit notes', status: 'consumed' }),
        ],
      },
    });
    useAppStore.getState().navigate({
      to: branchPlace({ sessionId: SESSION.id, mountPath: DUP.worktreePath, tab: 'work' }),
    });
  });

  it('leads Back to Work from the destination of an artifact menu action', async () => {
    renderWork();

    fireEvent.contextMenu(await screen.findByRole('button', { name: /^Plan Credit notes/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Open agent/ }));
    cleanup();
    act(() => useAppStore.getState().up());

    const place = topPlaceOf();
    expect(place?.at === 'session' ? place.view.target : null).toMatchObject({
      kind: 'branch',
      tab: 'work',
      mountPath: DUP.worktreePath,
    });
  });

  it('keeps the way back to Work after opening a child agent from the destination and going Back', async () => {
    renderWork();

    fireEvent.contextMenu(await screen.findByRole('button', { name: /^Plan Credit notes/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Open agent/ }));
    cleanup();
    act(() =>
      useAppStore
        .getState()
        .navigate({ to: agentPlace({ sessionId: SESSION.id, agentId: AT_DUP_TOO.id }) }),
    );
    act(() => useAppStore.getState().back());
    act(() => useAppStore.getState().up());

    const place = topPlaceOf();
    expect(place?.at === 'session' ? place.view.target : null).toMatchObject({
      kind: 'branch',
      tab: 'work',
      mountPath: DUP.worktreePath,
    });
  });

  it('shows a used artifact again on Back after it was opened from the used fold', async () => {
    renderWork();
    fireEvent.click(await screen.findByRole('button', { name: '1 used' }));
    fireEvent.click(screen.getByRole('button', { name: /^Plan Old credit notes/ }));
    cleanup();
    act(() => useAppStore.getState().up());
    renderWork();

    await screen.findByRole('button', { name: /^Plan Old credit notes/ });
  });

  it('shows an answered question again on Back after it was opened from the answered fold', async () => {
    renderWork();
    fireEvent.click(await screen.findByRole('button', { name: '1 answered' }));
    fireEvent.click(screen.getByRole('button', { name: /Question done/ }));
    cleanup();
    act(() => useAppStore.getState().back());
    renderWork();

    await screen.findByRole('button', { name: /Question done/ });
  });

  it('keeps the used fold shut on a first visit', async () => {
    renderWork();

    await screen.findByRole('button', { name: '1 used' });
    expect(screen.queryByRole('button', { name: /^Plan Old credit notes/ })).toBeNull();
  });
});
