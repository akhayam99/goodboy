// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { U21_RUN_TREE_SCENES } from './run-tree';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const renderScene = (id: keyof typeof U21_RUN_TREE_SCENES) => {
  const Scene = U21_RUN_TREE_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u21 run tree scenes', () => {
  it('registers exactly the scenes the plan names', () => {
    expect(Object.keys(U21_RUN_TREE_SCENES).sort()).toEqual([
      'workflow-run-finished-sets',
      'workflow-run-nested',
    ]);
  });

  it('folds the settled scouts under their running step and keeps the working set open', async () => {
    renderScene('workflow-run-finished-sets');

    const folds = await screen.findAllByRole('button', {
      name: /^3 scouts · done · \d+m · \$0\.09, expand$/,
    });
    const fold = folds[1]!;

    expect(folds).toHaveLength(2);
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Read the credit writer in payments-api')).toBeNull();
    expect(screen.getByText('Read the delivery log schema')).toBeDefined();
    expect(screen.getByText('Check the retry backoff in notify-relay')).toBeDefined();

    fireEvent.click(fold);

    expect(screen.getByText('Read the credit writer in payments-api')).toBeDefined();
    expect(screen.getByText('Find the webhook tests that cover a retry')).toBeDefined();
  });

  it.each(['workflow-run-finished-sets', 'workflow-run-nested'] as const)(
    '%s sits inside the real run page, the composer docked under the scrolling tree',
    async (id) => {
      renderScene(id);

      const tree = await screen.findByTestId('run-tree');
      const composer = await screen.findByTestId('orchestrator-hint-input');
      const edge = document.querySelector('[data-slot="scroll-edge"]');
      const scroller = edge?.previousElementSibling ?? null;

      expect(scroller?.contains(tree)).toBe(true);
      expect(scroller?.contains(composer)).toBe(false);
      expect(
        tree.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Show run summary' })).toBeDefined();
    },
  );

  it('shows a sub-agent of a sub-agent while its set is still working', async () => {
    renderScene('workflow-run-nested');

    expect(await screen.findByText('Map the retry path in notify-relay')).toBeDefined();
    expect(screen.getByText('Read the delivery queue worker')).toBeDefined();
    expect(screen.getByText('Read the sender client')).toBeDefined();
  });
});
