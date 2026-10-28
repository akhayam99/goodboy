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
import { U24_COMMENTS_TRIAGE_SCENES } from './comments-triage';

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
  const Scene = U24_COMMENTS_TRIAGE_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown comments-triage scene');
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const drawerOf = async (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: 'Fix comments' });

describe('comments-triage scenes', () => {
  it('shows one of each outcome with its next step', async () => {
    show({ name: 'fixcomments-mixed' });
    const drawer = await drawerOf();
    await waitFor(() =>
      expect(within(drawer).getByRole('button', { name: 'Close note' })).toBeDefined(),
    );
    expect(within(drawer).getByRole('button', { name: 'Apply and resolve 2' })).toBeDefined();
    expect(within(drawer).getByRole('button', { name: 'Post 1 reply' })).toBeDefined();
    expect(within(drawer).getByRole('button', { name: 'Answer' })).toBeDefined();
    expect(within(drawer).getByRole('button', { name: 'Retry' })).toBeDefined();
    expect(within(drawer).getByText('2 fixes proposed, 1 question, 2 replies')).toBeDefined();
  });

  it('shows only the open question with its answer field', async () => {
    show({ name: 'fixcomments-question' });
    const drawer = await drawerOf();
    await waitFor(() =>
      expect(within(drawer).getByRole('textbox', { name: 'Your answer' })).toBeDefined(),
    );
    expect(within(drawer).queryByRole('button', { name: /^Apply/ })).toBeNull();
  });

  it('shows the applied fixes as fixed with the short sha', async () => {
    show({ name: 'fixcomments-applied' });
    const drawer = await drawerOf();
    await waitFor(() => expect(within(drawer).getAllByText(/^Fixed in /).length).toBe(2));
    expect(within(drawer).queryByRole('button', { name: /^Apply/ })).toBeNull();
  });

  it.each(Object.keys(U24_COMMENTS_TRIAGE_SCENES))(
    '%s has no accessibility violations',
    async (name) => {
      const { container } = show({ name });
      await drawerOf();
      const { violations } = await runA11yCheck(container);
      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
