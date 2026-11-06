// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { PlanWithCount, ProviderRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ToastProvider } from '../../../../shared/components/Toast';
import { PLAN_FIXTURE_AT, PLAN_FIXTURE_SESSION, aPlan } from '../../../../test/planFixtures';
import {
  PLAN_IMPLEMENTER,
  aPlanDraft,
  aPlannerQuestion,
  seedPlanDrawer,
  type PlanDrawerSeed,
} from '../../../../test/planDrawerFixtures';
import { trackDraftSave } from '../../../plans/planComments/trackDraftSave';
import { PlanCommentsProvider } from './PlanCommentsProvider';

type Stubs = Partial<
  Pick<
    ReturnType<typeof useAppStore.getState>,
    'sendArtifactComments' | 'sendArtifactCommentsToAgent'
  >
>;

const renderProvider = ({
  seed,
  stubs = {},
  onSent,
  planOverrides = {},
}: {
  readonly seed: PlanDrawerSeed;
  readonly stubs?: Stubs;
  readonly onSent?: Parameters<typeof PlanCommentsProvider>[0]['onSent'];
  readonly planOverrides?: Partial<PlanWithCount>;
}) => {
  const { plan } = seedPlanDrawer(seed);
  useAppStore.setState(stubs);
  return render(
    <ToastProvider>
      <PlanCommentsProvider
        sessionId={PLAN_FIXTURE_SESSION}
        plan={{ ...aPlan(), ...plan, ...planOverrides }}
        onSent={onSent}
      >
        <p>the plan</p>
      </PlanCommentsProvider>
    </ToastProvider>,
  );
};

afterEach(cleanup);

describe('PlanCommentsProvider', () => {
  it('shows a hint and no button in the bar when the run waits and nobody commented', () => {
    renderProvider({ seed: { run: 'held' } });

    const bar = screen.getByTestId('plan-comment-bar');
    expect(within(bar).queryByRole('button')).toBeNull();
    within(bar).getByText('Select text or click a block to comment');
  });

  it('never draws Approve in the bar, with comments or without', () => {
    renderProvider({ seed: { run: 'held', drafts: [aPlanDraft()] } });

    expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull();
    expect(screen.queryByTestId('plan-bar-approve')).toBeNull();
  });

  it('shows no bar for a plan nothing waits on and nobody commented', () => {
    renderProvider({ seed: { run: 'none' } });

    expect(screen.queryByTestId('plan-comment-bar')).toBeNull();
  });

  it('shows no bar for a plan the run feeds on its own and nobody commented', () => {
    renderProvider({ seed: { run: 'feeding' } });

    expect(screen.queryByTestId('plan-comment-bar')).toBeNull();
  });

  it('keeps Approve away while the planner revises', () => {
    renderProvider({
      seed: {
        run: 'held',
        turn: { kind: 'running', runId: 'run-2' as ProviderRunId, startedAt: PLAN_FIXTURE_AT },
      },
    });

    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  it('tells the page what the planner did after Send', async () => {
    const onSent = vi.fn();
    renderProvider({
      seed: { run: 'held', drafts: [aPlanDraft()] },
      stubs: { sendArtifactComments: vi.fn(async () => ({ kind: 'unchanged' as const })) },
      onSent,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send to planner' }));

    await waitFor(() => expect(onSent).toHaveBeenCalledWith({ kind: 'unchanged' }));
  });

  describe('after the plan ran', () => {
    const RAN: Partial<PlanWithCount> = {
      status: 'consumed',
      consumptionCount: 1,
      lastConsumer: { agentId: PLAN_IMPLEMENTER, name: 'Implement' },
    };

    const sentToAgent = () =>
      vi.fn(async () => ({ kind: 'sentToAgent' as const, agentName: 'Implement' }));

    it('reads not sent, with Copy and Send to the agent that can still read them', () => {
      renderProvider({
        seed: { run: 'took', status: 'consumed', drafts: [aPlanDraft()] },
        planOverrides: RAN,
      });

      const bar = screen.getByTestId('plan-comment-bar');
      within(bar).getByText('1 comment not sent');
      within(bar).getByText('Implement can still read them.');
      within(bar).getByRole('button', { name: 'Copy' });
      within(bar).getByRole('button', { name: 'Send to Implement' });
      expect(within(bar).queryByRole('button', { name: 'Send to planner' })).toBeNull();
    });

    it('sends to the agent and says where they went', async () => {
      const send = sentToAgent();
      renderProvider({
        seed: { run: 'took', status: 'consumed', drafts: [aPlanDraft()] },
        stubs: { sendArtifactCommentsToAgent: send },
        planOverrides: RAN,
      });

      fireEvent.click(screen.getByRole('button', { name: 'Send to Implement' }));

      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: PLAN_FIXTURE_SESSION }),
      );
    });

    it('falls back to a filled Copy when the agent is stopped', async () => {
      renderProvider({
        seed: { run: 'took', status: 'consumed', drafts: [aPlanDraft()] },
        planOverrides: RAN,
      });
      useAppStore.setState((state) => ({
        sessionPhaseRuns: {
          [PLAN_FIXTURE_SESSION]: (state.sessionPhaseRuns[PLAN_FIXTURE_SESSION] ?? []).map(
            (agent) => (agent.id === PLAN_IMPLEMENTER ? { ...agent, status: 'stopped' } : agent),
          ),
        },
      }));

      const bar = screen.getByTestId('plan-comment-bar');
      await within(bar).findByText("Implement isn't running. Copy them instead.");
      expect(within(bar).queryByRole('button', { name: 'Send to Implement' })).toBeNull();
      expect(within(bar).getByRole('button', { name: 'Copy' }).getAttribute('data-variant')).toBe(
        'primary',
      );
    });

    it('copies the comments as one request to read', async () => {
      const copied: Array<string> = [];
      const writeText = vi.fn(async (text: string) => {
        copied.push(text);
      });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      renderProvider({
        seed: { run: 'took', status: 'consumed', drafts: [aPlanDraft()] },
        planOverrides: RAN,
      });

      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      expect(copied[0]).toContain('The owner left these comments');
    });

    it('shows the failure and keeps the comments when the send fails', async () => {
      const failed = vi.fn(async () => ({
        kind: 'failed' as const,
        reason: 'The agent did not answer',
      }));
      renderProvider({
        seed: { run: 'took', status: 'consumed', drafts: [aPlanDraft()] },
        stubs: { sendArtifactCommentsToAgent: failed },
        planOverrides: RAN,
      });

      fireEvent.click(screen.getByRole('button', { name: 'Send to Implement' }));

      expect((await screen.findByRole('alert')).textContent).toBe('The agent did not answer');
      screen.getByRole('button', { name: 'Send to Implement' });
    });
  });

  describe('with a comment still being saved', () => {
    const RAN_AGENT: Partial<PlanWithCount> = {
      status: 'consumed',
      consumptionCount: 1,
      lastConsumer: { agentId: PLAN_IMPLEMENTER, name: 'Implement' },
    };

    const pendingSave = () => {
      let settle: (outcome: 'saved' | 'failed') => void = () => undefined;
      const save = new Promise<void>((resolve, reject) => {
        settle = (outcome) => (outcome === 'saved' ? resolve() : reject(new Error('Locked')));
      });
      trackDraftSave({ save });
      return { settle, save };
    };

    it('sends to the planner only after the save, and not when it failed', async () => {
      const send = vi.fn(async () => ({ kind: 'unchanged' as const }));
      renderProvider({
        seed: { run: 'held', drafts: [aPlanDraft()] },
        stubs: { sendArtifactComments: send },
      });
      const first = pendingSave();

      fireEvent.click(screen.getByRole('button', { name: 'Send to planner' }));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(send).not.toHaveBeenCalled();
      first.settle('saved');
      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));

      const second = pendingSave();
      fireEvent.click(screen.getByRole('button', { name: 'Send to planner' }));
      second.settle('failed');
      await second.save.catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('sends to the agent only after the save', async () => {
      const send = vi.fn(async () => ({ kind: 'sentToAgent' as const, agentName: 'Implement' }));
      renderProvider({
        seed: { run: 'took', status: 'consumed', drafts: [aPlanDraft()] },
        stubs: { sendArtifactCommentsToAgent: send },
        planOverrides: RAN_AGENT,
      });
      const pending = pendingSave();

      fireEvent.click(screen.getByRole('button', { name: 'Send to Implement' }));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(send).not.toHaveBeenCalled();
      pending.settle('saved');

      await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    });

    it('copies only after the save', async () => {
      const writeText = vi.fn(async () => undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      renderProvider({
        seed: { run: 'took', status: 'consumed', drafts: [aPlanDraft()] },
        planOverrides: RAN_AGENT,
      });
      const pending = pendingSave();

      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(writeText).not.toHaveBeenCalled();
      pending.settle('saved');

      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    });
  });

  it('offers only Copy for a plan that ran with no agent to send to', () => {
    renderProvider({
      seed: { run: 'took', status: 'consumed', drafts: [aPlanDraft()] },
      planOverrides: { status: 'consumed', consumptionCount: 1, lastConsumer: null },
    });

    const bar = screen.getByTestId('plan-comment-bar');
    within(bar).getByText('1 comment not sent');
    within(bar).getByText('No agent to send them to. Copy them instead.');
    expect(within(bar).getByRole('button', { name: 'Copy' }).getAttribute('data-variant')).toBe(
      'primary',
    );
    expect(within(bar).queryByRole('button', { name: 'Send to planner' })).toBeNull();
  });

  it('makes Send wait while the planner has a question open', () => {
    renderProvider({
      seed: { run: 'held', drafts: [aPlanDraft()], questions: [aPlannerQuestion()] },
    });

    const send = screen.getByRole('button', { name: 'Send to planner' });
    expect(send.hasAttribute('disabled')).toBe(true);
    expect(send.getAttribute('title')).toBe('The planner asked a question. Answer it first.');
    expect(screen.queryByTestId('plan-comment-note')).toBeNull();
  });
});
