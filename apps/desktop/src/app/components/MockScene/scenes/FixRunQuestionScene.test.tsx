// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { FixRunQuestionScene } from './FixRunQuestionScene';
import { SESSION_ID } from './resolveSeed';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const renderScene = () =>
  render(
    <ToastProvider>
      <FixRunQuestionScene />
    </ToastProvider>,
  );

describe('the fix run transcript drawer scene', () => {
  it('lands the fix run on Branch Comments with its transcript in the drawer, no page of its own', async () => {
    renderScene();

    const lead = await screen.findByTestId('fix-run-lead');
    const state = useAppStore.getState();
    expect(state.activeLens[SESSION_ID]).toBe('branch');
    expect(state.drawer?.kind).toBe('transcript');
    expect(state.selectedAgentId[SESSION_ID] ?? null).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Fix run' })).toBeNull();
    expect(within(lead).getByText('Question from the fix run')).toBeDefined();
  });

  it('lists the commits of the two ready comments instead of saying the run left none', async () => {
    renderScene();

    const lead = await screen.findByTestId('fix-run-lead');

    expect(within(lead).queryByText('No commits yet')).toBeNull();
    expect(await within(lead).findByText('c81e5aa')).toBeDefined();
    expect(within(lead).getByText('3b7d10e')).toBeDefined();
  });

  it('opens on the Fix tab while the run asks a question', async () => {
    renderScene();

    await screen.findByTestId('fix-run-lead');

    expect(screen.getByRole('tab', { name: 'Fix' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('textbox', { name: 'Message to Fix run' })).toBeNull();
  });

  it('says the same number in the banner and in the drawer', async () => {
    renderScene();

    const lead = await screen.findByTestId('fix-run-lead');
    const banner = await screen.findByTestId('resolve-run-status');

    expect(within(lead).getByRole('heading', { name: 'Covers 3 comments' })).toBeDefined();
    expect(within(banner).getByText('Fix run · 3 comments')).toBeDefined();
    expect(within(banner).queryByRole('button', { name: 'Open transcript' })).toBeNull();
  });

  it('keeps the other comment of the branch out of this run', async () => {
    renderScene();

    await screen.findByTestId('fix-run-lead');
    const state = useAppStore.getState();

    expect(
      (state.sessionResolveAttempts[SESSION_ID] ?? []).map((attempt) => attempt.agentId),
    ).toEqual(['mock-resolve-agent-retry']);
  });

  it('shows the brief and the answer on the Transcript tab, not the empty state of a role', async () => {
    renderScene();

    await screen.findByTestId('fix-run-lead');
    fireEvent.click(screen.getByRole('tab', { name: 'Transcript' }));

    expect(await screen.findByText('Fixed two comments and asked about the third.')).toBeDefined();
    expect(screen.queryByText(/Addresses one comment/)).toBeNull();
    expect(screen.queryByText(/shares the session brief/)).toBeNull();
  });
});
