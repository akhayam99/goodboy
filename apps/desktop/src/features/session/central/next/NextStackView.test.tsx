// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { brandId, type AgentId, type MountId, type SessionId } from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { resetStoryStore } from '../../../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import type { SessionSuggestion } from '../../../suggestions/types';
import { actionCardsOf, type ActionCardModel, type AutoActionTarget } from './actionCardsOf';
import { NextStackView } from './NextStackView';
import type { CardActions } from './useActionCardActions';

const HARBORLINE = brandId<SessionId>({ value: 'session-harborline' });
const HOME = brandId<MountId>({ value: 'mount-home' });

const STUCK: AutoActionTarget = {
  agentId: brandId<AgentId>({ value: 'agent-home' }),
  rootAgentId: brandId<AgentId>({ value: 'agent-auto' }),
  role: 'Build the hero',
  noun: 'Implementer',
  kind: 'childBlocked',
  reason: null,
  reasonCode: null,
  mountId: HOME,
  plan: null,
  canRetry: true,
};

const SECOND_STUCK: AutoActionTarget = {
  ...STUCK,
  agentId: brandId<AgentId>({ value: 'agent-billing' }),
  role: 'Build the billing page',
  kind: 'timedOut',
  mountId: brandId<MountId>({ value: 'mount-billing' }),
};

const DECIDE: AutoActionTarget = {
  ...STUCK,
  agentId: brandId<AgentId>({ value: 'agent-approve' }),
  role: 'Approve the plan',
  kind: 'approve',
  canRetry: false,
};

const PUSH: SessionSuggestion = {
  id: 'push-branch:faq',
  kind: 'push-branch',
  priority: 41,
  band: 2,
  title: 'Push hl/feat-center-faq-page',
  sessionId: HARBORLINE,
  fingerprint: 'push-branch:faq',
  targetKey: 'branch:mount-faq',
  payload: {
    mountId: brandId<MountId>({ value: 'mount-faq' }),
    projectId: brandId({ value: 'project-harbor' }),
    projectName: 'harbor-portal',
    branch: 'hl/feat-center-faq-page',
    worktreePath: '/work/faq',
    state: 'not-pushed',
    ahead: 4,
    behind: 0,
  },
};

const SHIP = actionCardsOf({ owners: [], suggestions: [PUSH], autoTargets: [] });
const FIX = actionCardsOf({ owners: [], suggestions: [], autoTargets: [STUCK, SECOND_STUCK] });
const TWO_KINDS = actionCardsOf({
  owners: [],
  suggestions: [],
  autoTargets: [DECIDE, STUCK, SECOND_STUCK],
});

type RunLog = {
  readonly runs: Array<string>;
};

type ActionsParams = {
  readonly log: RunLog;
};

type CardParams = {
  readonly card: ActionCardModel;
};

const actionsOf =
  ({ log }: ActionsParams) =>
  ({ card }: CardParams): CardActions => ({
    main: {
      label: 'Go',
      ariaLabel: `Go ${card.id}`,
      isDisabled: false,
      isBusy: false,
      confirmRole: null,
      hasPicker: false,
      run: () => {
        log.runs.push(card.id);
      },
    },
    second: null,
    failure: null,
    isBusy: false,
    agentKind: null,
    menu: null,
    foldedTarget: null,
  });

type ShowParams = {
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly log?: RunLog;
};

const show = ({ cards, log = { runs: [] } }: ShowParams) =>
  render(
    <ToastProvider>
      <NextStackView sessionId={HARBORLINE} cards={cards} actionsFor={actionsOf({ log })} />
    </ToastProvider>,
  );

const headsOf = (): ReadonlyArray<string> =>
  [...document.querySelectorAll('[data-next-group-head]')].map((head) => head.textContent ?? '');

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('NextStackView', () => {
  it('shows one kind of group as rows under the title, with no label', () => {
    show({ cards: SHIP });

    expect(headsOf()).toEqual([]);
    expect(screen.getByRole('heading', { level: 2 }).parentElement?.textContent).toBe('Next1');
    expect(document.querySelectorAll('[data-action-card]')).toHaveLength(1);
  });

  it('labels two kinds of group with a quiet name and the count of the rows it heads', () => {
    show({ cards: TWO_KINDS });

    expect(headsOf()).toEqual(['Decide1', 'Fix2Retry 2']);
    for (const name of ['Decide', 'Fix']) {
      const group = screen.getByRole('region', { name });
      expect(within(group).queryByRole('button', { expanded: true })).toBeNull();
      expect(within(group).queryByRole('button', { expanded: false })).toBeNull();
    }
    expect(
      within(screen.getByRole('region', { name: 'Fix' })).getAllByTestId(/^action-card-/),
    ).toHaveLength(2);
    expect(
      within(screen.getByRole('region', { name: 'Decide' })).getAllByTestId(/^action-card-/),
    ).toHaveLength(1);
  });

  it('keeps Retry all at rest, without a label, when the only group is Fix', async () => {
    const log: RunLog = { runs: [] };
    show({ cards: FIX, log });

    expect(headsOf()).toEqual(['Retry 2']);
    await userEvent.click(screen.getByRole('button', { name: 'Retry the 2 stuck agents' }));

    expect([...log.runs].sort()).toEqual(FIX.map((card) => card.id).sort());
  });

  it('keeps Retry all in the head of its own group when two kinds show', () => {
    show({ cards: TWO_KINDS });

    expect(
      within(screen.getByRole('region', { name: 'Fix' })).getByRole('button', {
        name: 'Retry the 2 stuck agents',
      }),
    ).toHaveProperty('textContent', 'Retry 2');
    expect(
      within(screen.getByRole('region', { name: 'Decide' })).queryByRole('button', {
        name: /Retry/,
      }),
    ).toBeNull();
  });

  it('tabs through the rows in group order, the bulk button before the rows of its group', async () => {
    show({ cards: TWO_KINDS });
    const decideCard = TWO_KINDS.find((card) => card.kind === 'approve');
    const fixCards = TWO_KINDS.filter((card) => card.kind !== 'approve');

    const order: Array<string | null> = [];
    for (let step = 0; step < 4; step += 1) {
      await userEvent.tab();
      order.push(document.activeElement?.getAttribute('aria-label') ?? null);
    }

    expect(fixCards).toHaveLength(2);
    expect(order).toEqual([
      `Go ${decideCard?.id}`,
      'Retry the 2 stuck agents',
      `Go ${fixCards[0]?.id}`,
      `Go ${fixCards[1]?.id}`,
    ]);
  });
});
