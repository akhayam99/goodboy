// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { U24_COMMENTS_FIX_SCENES } from './comments-fix';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(() => {
  cleanup();
});

type Params = { readonly name: string };
const show = ({ name }: Params) => {
  const Scene = U24_COMMENTS_FIX_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown comments-fix scene');
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const drawerOf = async (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: 'Fix comments' });

describe('comments-fix scenes', () => {
  it('lists the open comments with nothing selected and the launch disabled', async () => {
    show({ name: 'fixcomments-list' });
    const drawer = await drawerOf();
    expect(within(drawer).getAllByRole('checkbox').length).toBeGreaterThan(2);
    expect(within(drawer).getByRole('button', { name: 'Start fix' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(within(drawer).queryByRole('heading', { level: 3, name: 'Activity' })).toBeNull();
  });

  it('labels the launch with the selected count', async () => {
    show({ name: 'fixcomments-selected' });
    const drawer = await drawerOf();
    expect(within(drawer).getByRole('button', { name: 'Start fix for 3' })).toBeDefined();
    expect(within(drawer).getByRole('button', { name: 'Analyze only' })).toBeDefined();
  });

  it('shows the running resolver in the Activity chain', async () => {
    show({ name: 'fixcomments-running' });
    const drawer = await drawerOf();
    await waitFor(() =>
      expect(within(drawer).getByRole('heading', { level: 3, name: 'Activity' })).toBeDefined(),
    );
    expect(within(drawer).getByText(/Fix comments · 3 comments · Running/)).toBeDefined();
  });

  it.each(Object.keys(U24_COMMENTS_FIX_SCENES))(
    '%s has no accessibility violations',
    async (name) => {
      const { container } = show({ name });
      await drawerOf();
      const { violations } = await runA11yCheck(container);
      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
