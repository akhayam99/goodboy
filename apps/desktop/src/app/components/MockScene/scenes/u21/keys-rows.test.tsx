// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

  it('shows run rows in the full log with one Mark all seen and no menu', async () => {
    renderHoverScene();

    const activity = await screen.findByRole('region', { name: 'Log entries' });
    const rows = Array.from(activity.querySelectorAll<HTMLElement>('[data-row-id^="run:"]'));

    expect(rows.length).toBeGreaterThan(1);
    expect(within(activity).queryByRole('button', { name: 'Activity actions' })).toBeNull();
    expect(within(activity).getByRole('button', { name: 'Mark all seen' })).toBeDefined();
  });
});
