// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { SessionDecision } from '@goodboy/types';
import { importStore, resetStoryStore, type StoryStore } from '../../store/storyHarness';
import { ContextTab } from '../../features/session/components/ContextTab';
import {
  SESSION_ID,
  seedActivityRunScene,
} from '../../app/components/MockScene/scenes/activityRunSeed';

const h = vi.hoisted(() => {
  const ledger: ReadonlyArray<SessionDecision> = [];
  return { ledger, persistRead: vi.fn(async () => undefined) };
});
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../store/storyHarness')).dbModuleMock({
    setSessionContextSeenAt: h.persistRead,
    listSessionDecisions: async () => h.ledger,
    listAskThreads: async () => [],
  }),
);

let store: StoryStore;
beforeAll(async () => {
  store = await importStore();
});
beforeEach(async () => {
  await resetStoryStore();
  seedActivityRunScene();
  h.ledger = store.getState().sessionDecisions[SESSION_ID] ?? [];
  h.persistRead.mockReset();
  h.persistRead.mockResolvedValue(undefined);
});
afterEach(cleanup);

const session = () => {
  const found = store.getState().sessions.find((candidate) => candidate.id === SESSION_ID);
  if (found === undefined) {
    throw new Error('Missing session');
  }
  return found;
};
const mount = () => render(<ContextTab session={session()} />);
const open = () => store.getState().openContextDrawer({ sessionId: SESSION_ID });

describe('Context tab', () => {
  it('opens on Goal and keeps marks until an explicit read, including leave and return', async () => {
    const before = store.getState().sessionContextSeenAt[SESSION_ID];
    open();
    const view = mount();
    await screen.findByText('Added');
    const tab = screen.getByTestId('context-tab');
    within(tab).getByText('Withdrawn');
    expect(store.getState().drawer).toBeNull();
    expect(store.getState().sessionContextSeenAt[SESSION_ID]).toBe(before);
    expect(screen.queryByRole('region', { name: 'Changed since you last looked' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    await waitFor(() => expect(screen.queryByText('Added')).toBeNull());
    expect(h.persistRead).toHaveBeenCalledOnce();
    view.unmount();
    mount();
    screen.getByTestId('context-tab');
    expect(screen.queryByText('Added')).toBeNull();
  });

  it('keeps a failed read visible and retries it in place', async () => {
    h.persistRead.mockRejectedValueOnce(new Error('disk full'));
    open();
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as read' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Mark as read' }).hasAttribute('disabled')).toBe(
        false,
      ),
    );
    screen.getByText('Added');
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    await waitFor(() => expect(screen.queryByText('Added')).toBeNull());
  });

  it('draws State beyond the Overview sentence and keeps the complete context for copying', async () => {
    open();
    mount();
    const tab = await screen.findByTestId('context-tab');
    const summary = within(tab).getByRole('region', { name: 'Summary' });
    within(summary).getByRole('region', { name: 'State' });
    within(summary).getByRole('region', { name: 'Next' });
    within(summary).getByRole('region', { name: 'Learned' });
    screen.getByRole('button', { name: 'Copy context' });
    expect(
      store.getState().sessionSlots[SESSION_ID]?.find((slot) => slot.key === 'last_output_summary')
        ?.value,
    ).toContain('State');
  });
});
