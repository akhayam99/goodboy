// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { selectIsSessionDraftShown } from '../../../../store/slices/sessionDraft/selectIsSessionDraftShown';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  WORKSPACE_ID,
  seedBoardScene,
} from '../../../../app/components/MockScene/scenes/BoardScene';
import { SessionDraftPane } from '.';

let useAppStore: StoryStore;
let cameFrom: SessionId;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedBoardScene();
  const first = useAppStore.getState().sessions[0];
  if (first === undefined) {
    throw new Error('the board seed has no session');
  }
  cameFrom = first.id;
});

afterEach(() => {
  cleanup();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const openDraft = async ({ text = '' }: { readonly text?: string } = {}): Promise<void> => {
  useAppStore.getState().navigate({ to: sessionPlace({ sessionId: cameFrom }) });
  useAppStore.getState().openSessionDraft();
  useAppStore.getState().patchSessionDraft({
    workspaceId: WORKSPACE_ID,
    patch: { ...(text !== '' && { workflowGoal: text }), startKind: 'auto', hasChosenStart: true },
  });
  render(
    <ToastProvider>
      <SessionDraftPane workspaceId={WORKSPACE_ID} />
    </ToastProvider>,
  );
  await settle();
};

const pressEscape = async (): Promise<void> => {
  fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
  await settle();
};

const isDraftShown = (): boolean => selectIsSessionDraftShown({ state: useAppStore.getState() });

const goalOfDraft = (): string =>
  useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.workflowGoal ?? '';

describe('closing the New session page', () => {
  it('shows no Esc label and no close button, and Discard only with content', async () => {
    await openDraft();

    expect(screen.queryByText('Esc')).toBeNull();
    expect(screen.queryByRole('button', { name: /close|esc/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();
    expect(screen.getByRole('button', { name: /Start blank/ })).toBeDefined();
  });

  it('shows Discard once something is written', async () => {
    await openDraft({ text: 'Round the ledger postings' });

    expect(screen.getByRole('button', { name: 'Discard' })).toBeDefined();
  });

  it('closes on Esc with nothing written, back to where you were', async () => {
    await openDraft();
    expect(isDraftShown()).toBe(true);

    await pressEscape();

    expect(isDraftShown()).toBe(false);
    expect(useAppStore.getState().currentSessionId).toBe(cameFrom);
    expect(screen.queryByText('Keep this draft?')).toBeNull();
  });

  it('asks on Esc with text, inline and without a dialog', async () => {
    await openDraft({ text: 'Round the ledger postings' });

    await pressEscape();

    expect(screen.getByText('Keep this draft?')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Keep draft' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Discard' })).toHaveLength(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    const notice = screen.getByText('Keep this draft?').closest('[data-slot="kickoff-notice"]');
    expect(notice?.closest('section[aria-label="Kickoff"]')).not.toBeNull();
    expect(isDraftShown()).toBe(true);
    expect(goalOfDraft()).toBe('Round the ledger postings');
  });

  it('keeps the draft on Keep draft, and New brings it back', async () => {
    await openDraft({ text: 'Round the ledger postings' });
    await pressEscape();

    fireEvent.click(screen.getByRole('button', { name: 'Keep draft' }));
    await settle();

    expect(isDraftShown()).toBe(false);
    expect(useAppStore.getState().currentSessionId).toBe(cameFrom);
    expect(goalOfDraft()).toBe('Round the ledger postings');

    act(() => useAppStore.getState().openSessionDraft());
    await settle();
    expect(isDraftShown()).toBe(true);
    expect(goalOfDraft()).toBe('Round the ledger postings');
  });

  it('keeps the draft on a second Esc, the answer that loses nothing', async () => {
    await openDraft({ text: 'Round the ledger postings' });
    await pressEscape();

    await pressEscape();

    expect(isDraftShown()).toBe(false);
    expect(goalOfDraft()).toBe('Round the ledger postings');
  });

  it('discards for real from the actions row while asked, leaving the page', async () => {
    await openDraft({ text: 'Round the ledger postings' });
    await pressEscape();

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await settle();

    expect(isDraftShown()).toBe(false);
    expect(useAppStore.getState().openSessionDraftWorkspaceId).toBeNull();
    expect(goalOfDraft()).toBe('');
  });

  it('asks on Esc with only Start a run written, keeps it on reopen and Discard clears it', async () => {
    await openDraft();
    fireEvent.change(screen.getByRole('textbox', { name: 'Goal' }), {
      target: { value: 'Reconcile the Northwind ledger' },
    });

    await pressEscape();

    expect(screen.getByText('Keep this draft?')).toBeDefined();
    expect(isDraftShown()).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Keep draft' }));
    await settle();
    expect(isDraftShown()).toBe(false);
    cleanup();

    await openDraft();
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Goal' }).value).toBe(
      'Reconcile the Northwind ledger',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await settle();

    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.workflowGoal ?? '').toBe('');
  });

  it('lets up() leave the page from a written draft', async () => {
    await openDraft({ text: 'Round the ledger postings' });

    act(() => useAppStore.getState().up());
    await settle();

    expect(isDraftShown()).toBe(false);
    expect(useAppStore.getState().currentSessionId).toBe(cameFrom);
    expect(goalOfDraft()).toBe('Round the ledger postings');
  });
});
