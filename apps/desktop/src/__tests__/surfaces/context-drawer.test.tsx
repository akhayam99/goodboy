// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { SessionDecision } from '@goodboy/types';
import { importStore, resetStoryStore, type StoryStore } from '../../store/storyHarness';
import { DrawerHost } from '../../app/components/DrawerHost';
import { SessionTools } from '../../features/session/components/SessionTools';
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

const mount = () =>
  render(
    <>
      <SessionTools sessionId={SESSION_ID} />
      <DrawerHost />
    </>,
  );
const toggle = () => fireEvent.click(screen.getByTestId('pane-toggle-context'));

describe('Context from the session tools', () => {
  it('opens on Goal and keeps marks until an explicit read, including close and reopen', async () => {
    mount();
    const before = store.getState().sessionContextSeenAt[SESSION_ID];
    toggle();
    const drawer = await screen.findByRole('region', { name: 'Context' });
    expect(store.getState().drawer).toMatchObject({ payload: { section: 'goal' } });
    within(drawer).getByText('Added');
    within(drawer).getByText('Withdrawn');
    expect(store.getState().sessionContextSeenAt[SESSION_ID]).toBe(before);
    expect(screen.queryByRole('region', { name: 'Changed since you last looked' })).toBeNull();
    toggle();
    expect(screen.queryByRole('region', { name: 'Context' })).toBeNull();
    toggle();
    await screen.findByText('Added');
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    await waitFor(() => expect(screen.queryByText('Added')).toBeNull());
    expect(h.persistRead).toHaveBeenCalledOnce();
    toggle();
    toggle();
    screen.getByRole('region', { name: 'Context' });
    expect(screen.queryByText('Added')).toBeNull();
  });

  it('keeps a failed read visible and retries it in place', async () => {
    h.persistRead.mockRejectedValueOnce(new Error('disk full'));
    mount();
    toggle();
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
    mount();
    toggle();
    const drawer = await screen.findByRole('region', { name: 'Context' });
    const summary = within(drawer).getByRole('region', { name: 'Summary' });
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
