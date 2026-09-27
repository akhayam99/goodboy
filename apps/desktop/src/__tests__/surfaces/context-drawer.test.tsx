// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { IsoDateTime, SessionDecision } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { DrawerHost } from '../../app/components/DrawerHost';
import { ContextChip } from '../../features/session/components/SessionOverviewPane/ContextChip';
import {
  SESSION_ID,
  seedActivityRunScene,
} from '../../app/components/MockScene/scenes/activityRunSeed';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedActivityRunScene();
});

afterEach(() => {
  cleanup();
});

const renderSurface = () =>
  render(
    <>
      <ContextChip sessionId={SESSION_ID} />
      <DrawerHost />
    </>,
  );

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const dot = () => screen.queryByTestId('context-change-dot');

const seenAt = (): string | null | undefined =>
  useAppStore.getState().sessionContextSeenAt[SESSION_ID];

const ledger = (): ReadonlyArray<SessionDecision> =>
  useAppStore.getState().sessionDecisions[SESSION_ID] ?? [];

describe('Context drawer change marks', () => {
  it('shows the dot only after a real change since the last look', async () => {
    const lookedAt = new Date(Date.now() - 60_000).toISOString() as IsoDateTime;
    useAppStore.setState((state) => ({
      sessionContextSeenAt: { ...state.sessionContextSeenAt, [SESSION_ID]: lookedAt },
    }));
    renderSurface();
    await settle();

    expect(dot()).toBeNull();
    expect(screen.getByTestId('context-chip').textContent).toBe('Context');

    const template = ledger()[0]!;
    const arrived = new Date().toISOString() as IsoDateTime;
    act(() => {
      useAppStore.setState((state) => ({
        sessionDecisions: {
          ...state.sessionDecisions,
          [SESSION_ID]: [
            ...ledger(),
            {
              ...template,
              id: 'arrived',
              number: 9,
              text: 'Retry deliveries with a jittered backoff',
              previousText: null,
              rewordedAt: null,
              createdAt: arrived,
              updatedAt: arrived,
            },
          ],
        },
      }));
    });

    expect(dot()).not.toBeNull();
    expect(screen.getByTestId('context-chip').textContent).toBe('Context');
  });

  it('marks it seen on open and lists what was added, removed and reworded', async () => {
    const before = seenAt();
    renderSurface();
    await settle();
    expect(dot()).not.toBeNull();

    fireEvent.click(screen.getByTestId('context-chip'));
    await settle();

    expect(seenAt()).not.toBe(before);
    expect(dot()).toBeNull();
    const drawer = screen.getByRole('region', { name: 'Context' });
    expect(
      within(drawer)
        .getByRole('tab', { name: /Decisions/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
    const changed = within(drawer).getByRole('region', { name: 'Changed since you last looked' });
    const labels = within(changed)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(labels).toEqual([
      'Added: decision 7',
      'Replaced by 7: decision 5',
      'Withdrawn: decision 8',
      'Reworded: decision 1',
    ]);
  });

  it('starts clean on the next open once the drawer was closed', async () => {
    renderSurface();
    await settle();

    fireEvent.click(screen.getByTestId('context-chip'));
    await settle();
    fireEvent.click(screen.getByTestId('context-chip'));
    await settle();

    expect(screen.queryByRole('region', { name: 'Context' })).toBeNull();
    expect(dot()).toBeNull();

    fireEvent.click(screen.getByTestId('context-chip'));
    await settle();

    const drawer = screen.getByRole('region', { name: 'Context' });
    expect(
      within(drawer).queryByRole('region', { name: 'Changed since you last looked' }),
    ).toBeNull();
  });
});

describe('Context drawer summary', () => {
  it('reads the summary by section, key line first and the rest collapsed', async () => {
    act(() => {
      useAppStore.getState().openContextDrawer({ sessionId: SESSION_ID, tab: 'summary' });
    });
    renderSurface();
    await settle();

    const drawer = screen.getByRole('region', { name: 'Context' });
    const sections = within(drawer)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(sections).toEqual(['State4', 'Next3', 'Open questions1', 'Learned2']);

    const state = within(drawer).getByRole('region', { name: 'State' });
    expect(
      within(state).getByText('Dedupe check and idempotency column are live in payments-api'),
    ).toBeDefined();
    expect(within(state).queryByText('42 tests pass on the webhook handler')).toBeNull();

    fireEvent.click(within(state).getByRole('button', { name: 'Show 3 more' }));
    expect(within(state).getByText('42 tests pass on the webhook handler')).toBeDefined();
    expect(within(state).getByRole('button', { name: 'Show less' })).toBeDefined();

    const questions = within(drawer).getByRole('region', { name: 'Open questions' });
    expect(within(questions).getByText('How many retries should raise the banner?')).toBeDefined();
  });
});
