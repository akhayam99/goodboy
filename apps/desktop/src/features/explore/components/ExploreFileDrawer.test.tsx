// @vitest-environment happy-dom

const h = vi.hoisted(() => ({
  invoke: vi.fn<(command: string, args?: Record<string, unknown>) => Promise<unknown>>(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: h.invoke }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import { SESSION, sessionFixture } from '../../../__tests__/helpers/actionFixtures';
import { ToastProvider } from '../../../shared/components/Toast';
import { ExploreFileDrawer } from './ExploreFileDrawer';

const DIR = '/workspace/sessions/session-1';
const BODY = '# Read me\n\nsecond\nthird';
const ENTRY = {
  name: 'README.md',
  relPath: 'README.md',
  isDir: false,
  sizeBytes: 24,
  modifiedAt: new Date().toISOString(),
};

type DrawerParams = {
  readonly line?: number;
};

const drawer = ({ line }: DrawerParams) => (
  <ToastProvider>
    <ExploreFileDrawer
      sessionId={SESSION}
      sessionDir={DIR}
      entry={ENTRY}
      line={line}
      renderChanges={() => null}
      onClose={() => undefined}
    />
  </ToastProvider>
);

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  const store = await importStore();
  await resetStoryStore();
  store.setState({ sessions: [sessionFixture()], currentSessionId: SESSION });
  h.invoke.mockReset();
  h.invoke.mockImplementation(async (command) => {
    if (command === 'explore_read') {
      return { type: 'text', text: BODY, truncated: false };
    }
    return undefined;
  });
});

afterEach(cleanup);

describe('ExploreFileDrawer line target', () => {
  it('shows the rendered markdown when opened without a line', async () => {
    render(drawer({}));

    expect(await screen.findByRole('heading', { name: 'Read me' })).toBeDefined();
  });

  it('switches an open markdown preview to source and marks the line when a line target arrives', async () => {
    const { rerender } = render(drawer({}));
    await screen.findByRole('heading', { name: 'Read me' });

    rerender(drawer({ line: 3 }));

    const marked = await screen.findByText('second');
    expect(marked.closest('[data-source-line]')?.getAttribute('aria-current')).toBe('location');
    expect(screen.queryByRole('heading', { name: 'Read me' })).toBeNull();
  });

  it('moves to source again for a new line after the reader went back to the preview', async () => {
    const { rerender } = render(drawer({ line: 3 }));
    await screen.findByText('second');
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(await screen.findByRole('heading', { name: 'Read me' })).toBeDefined();

    rerender(drawer({ line: 4 }));

    const marked = await screen.findByText('third');
    expect(marked.closest('[data-source-line]')?.getAttribute('aria-current')).toBe('location');
  });

  it('keeps the reader on the preview when the line target goes away', async () => {
    const { rerender } = render(drawer({ line: 3 }));
    await screen.findByText('second');
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }));
    await screen.findByRole('heading', { name: 'Read me' });

    rerender(drawer({}));

    expect(screen.getByRole('heading', { name: 'Read me' })).toBeDefined();
  });
});
