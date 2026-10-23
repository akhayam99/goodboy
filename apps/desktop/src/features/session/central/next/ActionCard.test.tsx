// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type MountId,
  type ProjectId,
  type Session,
  type SessionProjectMount,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { UndoToastBridge } from '../../../../app/components/UndoToastBridge';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import type { SessionSuggestion } from '../../../suggestions/types';
import type { NeedsYouOwner } from '../../timeline/needsYou';
import type { SessionWorkModel } from '../useSessionWorkModel';

const { suggestionState, runs, recordNextStepOutcome, revertNextStepOutcome } = vi.hoisted(() => {
  const state: { list: ReadonlyArray<SessionSuggestion> } = { list: [] };
  return {
    suggestionState: state,
    runs: new Map<string, () => Promise<void>>(),
    recordNextStepOutcome: vi.fn(async (): Promise<string | null> => 'event'),
    revertNextStepOutcome: vi.fn(async (): Promise<void> => undefined),
  };
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    listNudgeEvents: vi.fn(async () => []),
  }),
);
vi.mock('../../../suggestions/useSessionSuggestions', () => ({
  useSessionSuggestions: () => suggestionState.list,
  useSessionSuggestionsFrom: () => suggestionState.list,
}));
vi.mock('../../../suggestions/useTranscriptMountProposals', () => ({
  useTranscriptMountProposals: () => [],
}));
vi.mock('../../../suggestions/useSuggestionActions', () => ({
  useSuggestionActions:
    () =>
    ({ suggestion }: { readonly suggestion: SessionSuggestion }) => ({
      primary: {
        label: `Act on ${suggestion.title}`,
        shortLabel: 'Do it',
        isDisabled: false,
        failureTitle: `Couldn't act on ${suggestion.title}`,
        run: () => runs.get(suggestion.id)?.() ?? Promise.resolve(),
      },
      onDismiss: null,
    }),
}));
vi.mock('../../../suggestions/useNextStepOutcomes', () => ({
  recordNextStepOutcome,
  revertNextStepOutcome,
}));

import type { AutoActionTarget } from './actionCardsOf';
import { NextStackView } from './NextStackView';
import { useNextCards } from './useNextCards';
import { useAppStore } from '../../../../store';
import type { AppStore } from '../../../../store/store';
import type { HistoryRun, HistoryStop } from '../../../../store/slices/history/types';
import { useRebaseStopRows } from '../../../history/useRebaseStopRows';
import { aRebaseRun } from '../../../history/testing/aRebaseRun';

type StackProps = {
  readonly session: Session;
  readonly model: SessionWorkModel;
  readonly autoTargets: ReadonlyArray<AutoActionTarget>;
};

const Stack = (props: StackProps) => {
  const { cards, actionsFor } = useNextCards(props);
  return <NextStackView sessionId={props.session.id} cards={cards} actionsFor={actionsFor} />;
};

const SESSION = aSession();

const MEMBERS_MOUNT: SessionProjectMount = {
  mountId: brandId<MountId>({ value: 'mount-members' }),
  sessionId: SESSION.id,
  projectId: brandId<ProjectId>({ value: 'project-harbor-portal' }),
  mountName: 'harbor-portal',
  worktreePath: '/w/harbor-portal-members',
  lastWorktreePath: null,
  repoRoot: '/repos/harbor-portal',
  branch: 'hl/feat-center-members-page',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const STOP_OWNER: NeedsYouOwner = {
  id: 'event:ev-members-stop',
  kind: 'rebase',
  text: 'Rebase of hl/feat-center-members-page stopped · conflict in MembersPage.tsx',
  where: null,
  at: '2026-10-22T10:00:00.000Z',
  item: null,
  question: null,
  questionIds: [],
  prNumber: null,
  owed: null,
  mountId: MEMBERS_MOUNT.mountId,
};

const STOP_CARD_ID = `action-card-owner:${STOP_OWNER.id}`;

type StopParams = {
  readonly stop: HistoryStop;
  readonly patch?: Partial<HistoryRun>;
};

const seedStop = ({ stop, patch = {} }: StopParams): void => {
  useAppStore.setState({
    sessions: [SESSION],
    sessionProjectMounts: { [SESSION.id]: [MEMBERS_MOUNT] },
    historyRuns: {
      [MEMBERS_MOUNT.mountId]: aRebaseRun({
        sessionId: SESSION.id,
        mountId: MEMBERS_MOUNT.mountId,
        phase: 'stopped',
        stop,
        ...patch,
      }),
    },
  });
};

const StopStack = (props: StackProps) => {
  const { cards, actionsFor } = useNextCards(props);
  const stopRowFor = useRebaseStopRows({ sessionId: props.session.id });
  return (
    <NextStackView
      sessionId={props.session.id}
      cards={cards}
      actionsFor={actionsFor}
      branchFor={({ card }) =>
        card.mountId === MEMBERS_MOUNT.mountId
          ? { branch: MEMBERS_MOUNT.branch, request: null }
          : null
      }
      stopRowFor={stopRowFor}
    />
  );
};

const showStop = (): void => {
  render(
    <ToastProvider>
      <StopStack session={SESSION} model={{ ...MODEL, owners: [STOP_OWNER] }} autoTargets={[]} />
    </ToastProvider>,
  );
};

const stopCard = (): HTMLElement => screen.getByTestId(STOP_CARD_ID);

const menuOf = (): ReadonlyArray<string> => {
  fireEvent.click(within(stopCard()).getByRole('button', { name: /^More options for / }));
  return screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
};

const MODEL: SessionWorkModel = {
  entries: [],
  events: [],
  autoTrees: [],
  workflows: [],
  advanceByRunId: new Map(),
  decidingRunIds: new Set(),
  unreadAgentIds: new Set(),
  liveAgentIds: undefined,
  owners: [],
  resolveFactsByAgentId: new Map(),
  jobFactsByAgentId: new Map(),
  autoFactsByAgentId: new Map(),
  isLoaded: true,
};

const suggestionOf = ({
  id,
  title,
  priority,
}: {
  readonly id: string;
  readonly title: string;
  readonly priority: number;
}): SessionSuggestion => ({
  id,
  kind: 'resolve-threads',
  priority,
  band: 2,
  title,
  sessionId: SESSION.id,
  targetKey: null,
  fingerprint: `${id}:fingerprint`,
  payload: { eligibleThreadCount: 2 },
});

const FIRST = suggestionOf({ id: 'first', title: 'Push ledger-core', priority: 1 });
const SECOND = suggestionOf({ id: 'second', title: 'Push notify-relay', priority: 2 });

const setup = () =>
  render(
    <ToastProvider>
      <UndoToastBridge />
      <Stack session={SESSION} model={MODEL} autoTargets={[]} />
    </ToastProvider>,
  );

const QUESTION_OWNER: NeedsYouOwner = {
  id: 'question-cap',
  kind: 'question',
  text: 'Cap per day or per payout?',
  where: 'Build step 4 waits on it',
  at: '2026-10-18T10:30:00.000Z',
  item: null,
  question: null,
  questionIds: ['question-cap'],
  prNumber: null,
  owed: null,
  mountId: null,
};

const NEVER_STARTED: AutoActionTarget = {
  agentId: brandId<AgentId>({ value: 'agent-fixer' }),
  rootAgentId: brandId<AgentId>({ value: 'agent-auto' }),
  role: 'Fixer',
  kind: 'neverStarted',
  noun: 'Fixer',
  reason: 'Auto created it at 10:21, no first message reached it.',
  reasonCode: null,
  mountId: null,
  plan: null,
  canRetry: true,
};

type CardAtParams = {
  readonly index: number;
  readonly cards: ReadonlyArray<Element>;
};

const cardAt = ({ index, cards }: CardAtParams): HTMLElement => {
  const card = cards[index];
  if (!(card instanceof HTMLElement)) {
    throw new Error('Expected a card');
  }
  return card;
};

type CardOfParams = {
  readonly id: string;
};

const cardOf = ({ id }: CardOfParams): HTMLElement =>
  screen.getByTestId(`action-card-suggestion:${id}`);

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  suggestionState.list = [FIRST, SECOND];
  runs.clear();
  recordNextStepOutcome.mockClear();
  revertNextStepOutcome.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('action cards in a stack', () => {
  it('gives the first card one primary button and a later card none', () => {
    setup();

    expect(
      within(cardOf({ id: 'first' })).getAllByRole('button', { name: /^Act on/ }),
    ).toHaveLength(1);
    expect(cardOf({ id: 'first' }).querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
    expect(cardOf({ id: 'second' }).querySelectorAll('[data-variant="primary"]')).toHaveLength(0);
    expect(
      within(cardOf({ id: 'second' })).getByRole('button', { name: /^Act on/ }).dataset.variant,
    ).toBe('secondary');
  });

  it('counts the cards in the section header and orders them by priority', () => {
    suggestionState.list = [SECOND, FIRST];
    setup();

    const region = screen.getByRole('region', { name: 'Next steps' });
    const heading = within(region).getByRole('heading', { level: 2, name: 'Next' });
    expect(heading.parentElement?.textContent).toBe('Next2');
    const titles = [...region.querySelectorAll('[data-action-card]')].map(
      (card) => card.getAttribute('data-testid') ?? '',
    );
    expect(titles).toEqual(['action-card-suggestion:first', 'action-card-suggestion:second']);
  });

  it('keeps Not now in the overflow and brings the card back with Undo', async () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'More options for Push ledger-core' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Not now' }));

    expect(screen.queryByText('Push ledger-core')).toBeNull();
    screen.getByText('Dismissed');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    screen.getByText('Push ledger-core');
    expect(revertNextStepOutcome).toHaveBeenCalledTimes(1);
  });

  it('keeps the card on a failed primary, shows the cause and relabels it Retry', async () => {
    runs.set('first', async () => {
      throw new Error('The branch is protected');
    });
    setup();

    await act(async () => {
      fireEvent.click(within(cardOf({ id: 'first' })).getByRole('button', { name: /^Act on/ }));
    });

    const card = cardOf({ id: 'first' });
    expect(within(card).getByRole('alert').textContent).toContain('The branch is protected');
    const retry = within(card).getByRole('button', { name: /Retry/ });
    expect(retry.textContent).toBe('Retry');
    expect(retry.dataset.variant).toBe('primary');
  });

  it('clears the cause when Retry succeeds', async () => {
    let calls = 0;
    runs.set('first', async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('The branch is protected');
      }
    });
    setup();
    await act(async () => {
      fireEvent.click(within(cardOf({ id: 'first' })).getByRole('button', { name: /^Act on/ }));
    });

    await act(async () => {
      fireEvent.click(within(cardOf({ id: 'first' })).getByRole('button', { name: /Retry/ }));
    });

    expect(within(cardOf({ id: 'first' })).queryByRole('alert')).toBeNull();
    expect(calls).toBe(2);
  });

  it('leads with the question in Decide and keeps the stuck Auto child in Fix, each with its verb', () => {
    suggestionState.list = [];
    render(
      <ToastProvider>
        <Stack
          session={SESSION}
          model={{ ...MODEL, owners: [QUESTION_OWNER] }}
          autoTargets={[NEVER_STARTED]}
        />
      </ToastProvider>,
    );

    const region = screen.getByRole('region', { name: 'Next steps' });
    const cardsNow = () => [...region.querySelectorAll('[data-action-card]')];
    expect(cardsNow().map((card) => card.getAttribute('data-testid'))).toEqual([
      'action-card-owner:question-cap',
    ]);
    const answer = within(cardAt({ index: 0, cards: cardsNow() })).getByRole('button', {
      name: 'Answer',
    });
    expect(answer.dataset.variant).toBe('primary');

    const fix = within(region).getByRole('region', { name: 'Fix' });
    fireEvent.click(within(fix).getByRole('button', { expanded: false }));

    const stuck = within(within(fix).getByTestId('action-card-auto:agent-fixer:neverStarted'));
    stuck.getByText('Auto is stuck');
    stuck.getByText(
      'The fixer never started. Auto created it at 10:21, no first message reached it.',
    );
    const retry = stuck.getByRole('button', { name: 'Retry "Fixer"' });
    expect(retry.dataset.variant).toBe('secondary');
    expect(retry.textContent).toBe('Retry');
    stuck.getByRole('button', { name: 'Open Auto' });
    expect(region.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
  });

  it('runs the task once on a double click', async () => {
    let finish: () => void = () => undefined;
    const task = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    runs.set('first', task);
    setup();
    const button = within(cardOf({ id: 'first' })).getByRole('button', { name: /^Act on/ });

    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    await act(async () => {
      finish();
    });

    expect(task).toHaveBeenCalledTimes(1);
    expect(recordNextStepOutcome).toHaveBeenCalledTimes(1);
  });
});

describe('a stopped rebase in Next', () => {
  const CONFLICT: HistoryStop = {
    reason: 'conflict',
    message: '2 files conflict with main.',
    files: ['src/pages/members/MembersPage.tsx', 'src/pages/members/members.css'],
    sha: null,
    head: 'b0a1c2d',
  };

  const CONFLICT_RUN: Partial<HistoryRun> = {
    rebaseConflict: {
      ontoRef: 'origin/main',
      baseBranch: 'main',
      head: 'b0a1c2d',
      autoAgentId: null,
    },
  };

  beforeEach(() => {
    suggestionState.list = [];
  });

  it('titles the row by its branch, says what stopped in one sentence, and leads with Resolve with Auto', () => {
    seedStop({ stop: CONFLICT, patch: CONFLICT_RUN });
    showStop();

    const card = within(stopCard());
    card.getByText('hl/feat-center-members-page');
    card.getByText(
      '2 files conflict with main: MembersPage.tsx and 1 more. Your branch is as it was.',
    );
    const main = card.getByRole('button', {
      name: 'Resolve with Auto on hl/feat-center-members-page',
    });
    expect(main.textContent).toBe('Resolve with Auto');
    expect(menuOf()).toEqual(['Resolve myself', 'Keep branch as it was', 'Open branch']);
  });

  it.each([
    [
      { reason: 'origin-moved', message: 'Origin moved.', files: [], sha: null },
      'Bring them in',
      'Rebased here, but someone pushed to origin. Nothing was pushed.',
    ],
    [
      { reason: 'failed', message: 'git failed', files: [], sha: null },
      'Retry rebase',
      "Couldn't rebase harbor-portal on main.",
    ],
    [
      { reason: 'push-failed', message: 'remote unreachable', files: [], sha: null },
      'Fix with agent',
      'Rebased, but the push failed.',
    ],
  ] satisfies ReadonlyArray<readonly [HistoryStop, string, string]>)(
    'leads a %j stop with its own verb',
    (stop, verb, sentence) => {
      seedStop({ stop });
      showStop();

      const card = within(stopCard());
      card.getByText(sentence);
      expect(
        card.getByRole('button', { name: `${verb} on hl/feat-center-members-page` }).textContent,
      ).toBe(verb);
    },
  );

  it('retries a failed rebase from the row and keeps the cause on it when it fails again', async () => {
    const rebaseBranch = vi
      .fn<() => Promise<'rebased'>>()
      .mockRejectedValueOnce(new Error('git is busy'));
    useAppStore.setState({ rebaseBranch });
    seedStop({ stop: { reason: 'failed', message: 'git failed', files: [], sha: null } });
    showStop();

    await act(async () => {
      fireEvent.click(
        within(stopCard()).getByRole('button', {
          name: 'Retry rebase on hl/feat-center-members-page',
        }),
      );
    });

    expect(rebaseBranch).toHaveBeenCalledWith({
      sessionId: SESSION.id,
      mountId: MEMBERS_MOUNT.mountId,
    });
    within(stopCard()).getByText('git is busy');
  });

  it('folds the diverged card of the same branch into the stop, never as And 1 more', () => {
    seedStop({ stop: { reason: 'origin-moved', message: 'Origin moved.', files: [], sha: null } });
    suggestionState.list = [
      {
        id: 'push-branch:members',
        kind: 'push-branch',
        priority: 5,
        band: 1,
        title: 'hl/feat-center-members-page diverged from origin',
        sessionId: SESSION.id,
        targetKey: null,
        fingerprint: 'push-branch:members:diverged',
        payload: {
          mountId: MEMBERS_MOUNT.mountId,
          projectId: MEMBERS_MOUNT.projectId,
          projectName: 'harbor-portal',
          branch: MEMBERS_MOUNT.branch,
          worktreePath: MEMBERS_MOUNT.worktreePath,
          state: 'diverged',
          ahead: 4,
          behind: 1,
        },
      },
    ];
    showStop();

    const region = screen.getByRole('region', { name: 'Next steps' });
    expect(region.querySelectorAll('[data-action-card]')).toHaveLength(1);
    expect(stopCard().textContent).not.toContain('And 1 more');
    expect(menuOf()).toContain('hl/feat-center-members-page diverged from origin');
  });

  it('updates every stopped branch from Update all in the group header, and shows a failure on its row', async () => {
    const PROFILE_MOUNT: SessionProjectMount = {
      ...MEMBERS_MOUNT,
      mountId: brandId<MountId>({ value: 'mount-profile' }),
      worktreePath: '/w/harbor-portal-profile',
      branch: 'hl/feat-center-profile-page',
    };
    const PROFILE_OWNER: NeedsYouOwner = {
      ...STOP_OWNER,
      id: 'event:ev-profile-stop',
      text: 'Rebase of hl/feat-center-profile-page stopped · origin moved',
      mountId: PROFILE_MOUNT.mountId,
    };
    const updateAll = vi.fn<AppStore['updateAll']>(async () => {
      useAppStore.setState({
        rebaseAllRuns: {
          [SESSION.id]: {
            id: 'run-update',
            sessionId: SESSION.id,
            startedAt: 0,
            shouldTidy: false,
            isAborted: false,
            phase: 'done',
            autoAgentId: null,
            error: null,
            branches: [
              {
                mountId: MEMBERS_MOUNT.mountId,
                projectName: 'harbor-portal',
                branch: MEMBERS_MOUNT.branch,
                state: 'failed',
                message: 'git is busy',
              },
            ],
          },
        },
      });
      return 'done';
    });
    useAppStore.setState({
      updateAll,
      sessions: [SESSION],
      sessionProjectMounts: { [SESSION.id]: [MEMBERS_MOUNT, PROFILE_MOUNT] },
      historyRuns: {
        [MEMBERS_MOUNT.mountId]: aRebaseRun({
          sessionId: SESSION.id,
          mountId: MEMBERS_MOUNT.mountId,
          phase: 'stopped',
          stop: { reason: 'failed', message: 'git failed', files: [], sha: null },
        }),
        [PROFILE_MOUNT.mountId]: aRebaseRun({
          sessionId: SESSION.id,
          mountId: PROFILE_MOUNT.mountId,
          phase: 'stopped',
          stop: { reason: 'origin-moved', message: 'Origin moved.', files: [], sha: null },
        }),
      },
    });
    render(
      <ToastProvider>
        <StopStack
          session={SESSION}
          model={{ ...MODEL, owners: [STOP_OWNER, PROFILE_OWNER] }}
          autoTargets={[]}
        />
      </ToastProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Update all 2 branches' }));
    });

    expect(updateAll).toHaveBeenCalledWith({
      sessionId: SESSION.id,
      rebaseMountIds: [MEMBERS_MOUNT.mountId],
      bringInMountIds: [PROFILE_MOUNT.mountId],
    });
    within(stopCard()).getByText('git is busy');
  });
});
