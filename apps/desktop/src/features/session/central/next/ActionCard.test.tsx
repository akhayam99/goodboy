// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type AgentId, type Session } from '@goodboy/types';
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

type StackProps = {
  readonly session: Session;
  readonly model: SessionWorkModel;
  readonly autoTargets: ReadonlyArray<AutoActionTarget>;
};

const Stack = (props: StackProps) => {
  const { cards, actionsFor } = useNextCards(props);
  return <NextStackView cards={cards} actionsFor={actionsFor} />;
};

const SESSION = aSession();

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
};

const NEVER_STARTED: AutoActionTarget = {
  agentId: brandId<AgentId>({ value: 'agent-fixer' }),
  rootAgentId: brandId<AgentId>({ value: 'agent-auto' }),
  role: 'Fixer',
  kind: 'neverStarted',
  reason: 'Auto created it at 10:21, no first message reached it.',
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
    within(region).getByRole('heading', { level: 2, name: 'Next' });
    within(region).getByText('2');
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

  it('leads with a never started Auto child, then the owner question, each with its own verb', () => {
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

    const cards = [
      ...screen.getByRole('region', { name: 'Next steps' }).querySelectorAll('[data-action-card]'),
    ];
    expect(cards.map((card) => card.getAttribute('data-testid'))).toEqual([
      'action-card-auto:agent-fixer:neverStarted',
      'action-card-owner:question-cap',
    ]);
    const retry = within(cardAt({ index: 0, cards })).getByRole('button', { name: 'Retry Fixer' });
    expect(retry.dataset.variant).toBe('primary');
    within(cardAt({ index: 0, cards })).getByRole('button', { name: 'Open Auto' });
    const answer = within(cardAt({ index: 1, cards })).getByRole('button', { name: 'Answer' });
    expect(answer.dataset.variant).toBe('secondary');
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
