// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { FixRunQuestionScene } from './FixRunQuestionScene';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('the fix run page scene', () => {
  it('is named like its Activity row and says Needs you while a comment waits for an answer', async () => {
    render(
      <ToastProvider>
        <FixRunQuestionScene />
      </ToastProvider>,
    );

    const title = await screen.findByTestId('agent-header-title-row');
    expect(title.textContent).toContain('Fix run · #318 · 3 comments');
    expect(screen.queryByText(/Resolve: 3 review comments/)).toBeNull();
    const meta = within(screen.getByTestId('agent-header-meta'));
    expect(meta.getByText('Needs you')).toBeDefined();
    expect(meta.queryByText('Ready')).toBeNull();
  });

  it('lists the commits of the two ready comments instead of saying the run left none', async () => {
    render(
      <ToastProvider>
        <FixRunQuestionScene />
      </ToastProvider>,
    );

    await screen.findByTestId('agent-header-title-row');

    expect(screen.queryByText('This run left no commit.')).toBeNull();
    expect(await screen.findByText('c81e5aa')).toBeDefined();
    expect(screen.getByText('3b7d10e')).toBeDefined();
  });
});
