// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U21_KEYS_ROWS_SCENES } from './keys-rows';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const renderHoverScene = () => {
  const Scene = U21_KEYS_ROWS_SCENES['activity-run-hover'];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the activity-run-hover scene', () => {
  it('is registered for the capture', () => {
    expect(MOCK_SCENES['activity-run-hover']).toBe(U21_KEYS_ROWS_SCENES['activity-run-hover']);
  });

  it('shows run rows beside a waiting row and an unread row', async () => {
    renderHoverScene();

    const activity = await screen.findByRole('region', { name: 'Activity' });
    const rows = Array.from(activity.querySelectorAll<HTMLElement>('[data-row-id^="run:"]'));

    expect(rows.length).toBeGreaterThan(1);
    expect(within(activity).getByRole('button', { name: 'Answer' })).toBeDefined();
    expect(within(activity).getByRole('button', { name: 'Mark all seen' })).toBeDefined();
  });
});
