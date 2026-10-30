// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import {
  registerDelegationDecisionPort,
  type DelegationDecisionPort,
} from '../../delegationDecisionPort';
import { aDelegation, aView, FIXTURE_ROOT, FIXTURE_SESSION } from '../../testing/autoViewFixtures';
import { AutoDelegationLines } from '../AutoDelegationLines';

const SENT = { blockedOverBudget: false };

type Store = Awaited<ReturnType<typeof importStore>>;

let useAppStore: Store;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  registerDelegationDecisionPort({ port: null });
});

const PROPOSAL = aDelegation({
  key: 'impl',
  role: 'implementer',
  state: 'awaiting_confirm',
  alternatives: [
    { label: 'Spawn a tester first', role: 'tester' },
    { label: 'Ask a reviewer to look', role: 'reviewer' },
  ],
});

const renderCard = () => {
  const view = aView({ phase: 'waiting', delegations: [PROPOSAL] });
  useAppStore.setState({ autoTreeViews: { [FIXTURE_SESSION]: [view] } });
  return render(
    <AutoDelegationLines
      sessionId={FIXTURE_SESSION}
      view={view}
      delegations={view.delegations}
      agents={[]}
      onOpenChild={vi.fn()}
      onOpenArtifact={vi.fn()}
    />,
  );
};

const mockSend = () => {
  const sendTurn = vi.fn(async () => SENT);
  useAppStore.setState({ sendTurn });
  return sendTurn;
};

const hintBox = () => {
  if (screen.queryByRole('textbox', { name: 'Add a hint' }) === null) {
    fireEvent.click(screen.getByRole('button', { name: 'Add a hint' }));
  }
  return screen.getByRole('textbox', { name: 'Add a hint' });
};

const pickedLabel = () =>
  screen.getAllByRole('option').find((option) => option.getAttribute('aria-selected') === 'true')
    ?.textContent;

describe('the next step card', () => {
  it('shows the proposed child as the primary and the alternatives, never a prose question', () => {
    renderCard();

    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(pickedLabel()).toContain('Spawn implementer');
    expect(pickedLabel()).toContain('Recommended');
    screen.getByText('Spawn a tester first');
    screen.getByText('Ask a reviewer to look');
    screen.getByRole('button', { name: 'Spawn implementer' });
  });

  it('marks the waiting state with one warning dot and no rail, label or fill', () => {
    const { container } = renderCard();
    const card = screen.getByRole('region', { name: 'Next step' });

    expect(card.querySelectorAll('[data-testid="tone-bar"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-next-action] .bg-warning')).toHaveLength(1);
    expect(card.innerHTML).not.toMatch(/text-warning|bg-warning\/|border-warning|bg-elevated/);
  });

  it('shows the choices as one listbox with Recommended as a tag on the first', () => {
    renderCard();
    const group = screen.getByRole('listbox', { name: 'Next step choices' });

    expect(within(group).getAllByRole('option')).toHaveLength(3);
    expect(within(group).getAllByText('Recommended')).toHaveLength(1);
    expect(screen.getAllByRole('option')[0]?.textContent).toContain('Recommended');
  });

  it('keeps the hint field behind Add a hint until asked and then focuses it', () => {
    renderCard();

    expect(screen.queryByRole('textbox', { name: 'Add a hint' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add a hint' }));

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Add a hint' }));
    expect(screen.queryByRole('button', { name: 'Add a hint' })).toBeNull();
  });

  it('moves the pick with the arrow keys and keeps focus on the chosen chip', () => {
    renderCard();
    const [first, second] = screen.getAllByRole('option');
    first?.focus();

    fireEvent.keyDown(first ?? document.body, { key: 'ArrowRight' });
    expect(pickedLabel()).toContain('Spawn a tester first');
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second ?? document.body, { key: 'ArrowLeft' });
    expect(pickedLabel()).toContain('Spawn implementer');
  });

  it('sends the hint after it is opened and the Enter key is pressed in it', async () => {
    const port = vi.fn<DelegationDecisionPort>(async () => 'confirmed');
    registerDelegationDecisionPort({ port });
    renderCard();

    fireEvent.change(hintBox(), { target: { value: 'keep it small' } });
    fireEvent.keyDown(hintBox(), { key: 'Enter' });

    await waitFor(() =>
      expect(port).toHaveBeenCalledWith({
        delegationId: 'delegation-impl',
        decision: 'confirm',
        hint: 'keep it small',
      }),
    );
  });

  it('picks with the keys 1 to 3 inside the card and ignores them while the hint is typed in', () => {
    renderCard();
    const card = screen.getByRole('region', { name: 'Next step' });

    fireEvent.keyDown(card, { key: '2' });
    expect(pickedLabel()).toContain('Spawn a tester first');
    fireEvent.keyDown(card, { key: '3' });
    expect(pickedLabel()).toContain('Ask a reviewer to look');
    fireEvent.keyDown(hintBox(), { key: '1' });
    expect(pickedLabel()).toContain('Ask a reviewer to look');
    fireEvent.keyDown(card, { key: '1' });
    expect(pickedLabel()).toContain('Spawn implementer');
  });

  it('confirms the primary with the hint and without a model turn', async () => {
    const port = vi.fn<DelegationDecisionPort>(async () => 'confirmed');
    registerDelegationDecisionPort({ port });
    const sendTurn = mockSend();
    renderCard();

    fireEvent.change(hintBox(), { target: { value: 'keep the retry cap' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spawn implementer' }));

    await waitFor(() => expect(port).toHaveBeenCalledOnce());
    expect(port).toHaveBeenCalledWith({
      delegationId: 'delegation-impl',
      decision: 'confirm',
      hint: 'keep the retry cap',
    });
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('declines first and then tells Auto the structured next step', async () => {
    const order: string[] = [];
    const port = vi.fn<DelegationDecisionPort>(async ({ decision }) => {
      order.push(decision);
      return 'declined';
    });
    registerDelegationDecisionPort({ port });
    const sendTurn = vi.fn(async () => {
      order.push('message');
      return SENT;
    });
    useAppStore.setState({ sendTurn });
    renderCard();

    fireEvent.keyDown(screen.getByRole('region', { name: 'Next step' }), { key: '2' });
    fireEvent.change(hintBox(), { target: { value: 'cover the idempotency path' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spawn a tester first' }));

    await waitFor(() => expect(sendTurn).toHaveBeenCalledOnce());
    expect(order).toEqual(['decline', 'message']);
    expect(port).toHaveBeenCalledWith({ delegationId: 'delegation-impl', decision: 'decline' });
    expect(sendTurn).toHaveBeenCalledWith({
      sessionId: FIXTURE_SESSION,
      agentId: FIXTURE_ROOT,
      content: 'Next step: tester\ncover the idempotency path',
    });
  });

  it('sends no message when the decline lost to another window', async () => {
    registerDelegationDecisionPort({ port: async () => 'lost' });
    const sendTurn = mockSend();
    renderCard();

    fireEvent.click(screen.getByRole('option', { name: /Spawn a tester first/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Spawn a tester first' }));

    await screen.findByText(/No longer open/);
    expect(sendTurn).not.toHaveBeenCalled();
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('says the confirm lost and offers nothing more to press', async () => {
    registerDelegationDecisionPort({ port: async () => 'lost' });
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Spawn implementer' }));

    await screen.findByText(/No longer open/);
    expect(screen.queryByRole('button', { name: 'Spawn implementer' })).toBeNull();
  });

  it('keeps the pick and the hint when the start fails and offers Retry on the same delegation', async () => {
    const port = vi
      .fn<DelegationDecisionPort>()
      .mockRejectedValueOnce(new Error('database is locked'))
      .mockResolvedValueOnce('confirmed');
    registerDelegationDecisionPort({ port });
    renderCard();

    fireEvent.change(hintBox(), { target: { value: 'small diff' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spawn implementer' }));

    await screen.findByText(/database is locked/);
    expect(hintBox().getAttribute('value')).toBe('small diff');
    expect(pickedLabel()).toContain('Spawn implementer');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(port).toHaveBeenCalledTimes(2));
    expect(port).toHaveBeenLastCalledWith({
      delegationId: 'delegation-impl',
      decision: 'confirm',
      hint: 'small diff',
    });
  });

  it('keeps the card as Declined, Auto was not told when the message fails, and Tell Auto sends only the message', async () => {
    const port = vi.fn<DelegationDecisionPort>(async () => 'declined');
    registerDelegationDecisionPort({ port });
    const sendTurn = vi
      .fn()
      .mockRejectedValueOnce(new Error('no route to Auto'))
      .mockResolvedValueOnce(SENT);
    useAppStore.setState({ sendTurn });
    renderCard();

    fireEvent.click(screen.getByRole('option', { name: /Spawn a tester first/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Spawn a tester first' }));

    await screen.findByText('Declined. Auto was not told.');
    fireEvent.click(screen.getByRole('button', { name: 'Tell Auto' }));

    await waitFor(() => expect(sendTurn).toHaveBeenCalledTimes(2));
    expect(port).toHaveBeenCalledOnce();
    expect(sendTurn).toHaveBeenLastCalledWith({
      sessionId: FIXTURE_SESSION,
      agentId: FIXTURE_ROOT,
      content: 'Next step: tester',
    });
    await waitFor(() => expect(screen.queryByText('Declined. Auto was not told.')).toBeNull());
  });

  it('declines for Not now and tells nothing', async () => {
    const port = vi.fn<DelegationDecisionPort>(async () => 'declined');
    registerDelegationDecisionPort({ port });
    const sendTurn = mockSend();
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    await waitFor(() =>
      expect(port).toHaveBeenCalledWith({ delegationId: 'delegation-impl', decision: 'decline' }),
    );
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('says so inline when no window can take the answer', async () => {
    registerDelegationDecisionPort({ port: null });
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Spawn implementer' }));

    await screen.findByText(/can't take this answer/);
    screen.getByRole('button', { name: 'Retry' });
  });
});
