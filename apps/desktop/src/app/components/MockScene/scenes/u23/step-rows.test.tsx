// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { WORK_META_COLUMN } from '@goodboy/ui';
import { carriesSpec } from '../../../../../test/classTokens';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { U23_STEP_ROWS_SCENES } from './step-rows';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const renderScene = (id: keyof typeof U23_STEP_ROWS_SCENES) => {
  const Scene = U23_STEP_ROWS_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const WAIT = { timeout: 4000 };

const MODEL_COLUMN = '[data-meta-column="model"]';

const namesIn = ({ root }: { readonly root: HTMLElement }): ReadonlyArray<string | null> =>
  Array.from(root.querySelectorAll(`${MODEL_COLUMN} [data-routing-part="name"]`)).map(
    (name) => name.textContent,
  );

const effortsIn = ({ root }: { readonly root: HTMLElement }): ReadonlyArray<string | null> =>
  Array.from(root.querySelectorAll(`${MODEL_COLUMN} [data-routing-part="detail"]`)).map(
    (effort) => effort.textContent,
  );

describe('the u23 step row scenes', () => {
  it('registers the two surfaces of the shared row grammar', () => {
    expect(Object.keys(U23_STEP_ROWS_SCENES).sort()).toEqual([
      'step-rows-activity',
      'step-rows-runs',
    ]);
  });

  it('draws the Runs steps as role icon, title, model with effort, then time and cost', async () => {
    const { container } = renderScene('step-rows-runs');

    const tree = await screen.findByTestId('run-tree', undefined, WAIT);

    expect(within(tree).queryByText('Implementer')).toBeNull();
    expect(within(tree).getAllByRole('img', { name: 'Implementer' }).length).toBeGreaterThan(0);
    expect(namesIn({ root: tree })).toContain('Opus 5.5');
    expect(effortsIn({ root: tree })).toContain('High');
    for (const cell of tree.querySelectorAll(MODEL_COLUMN)) {
      expect(carriesSpec({ element: cell, spec: WORK_META_COLUMN.model })).toBe(true);
    }
    expect(container.querySelector('[data-meta-column="stack"]')).not.toBeNull();
  });

  it('keeps a long title on one line and shows a handoff chain compactly', async () => {
    renderScene('step-rows-runs');

    const tree = await screen.findByTestId('run-tree', undefined, WAIT);

    const title = within(tree).getByText(/^Agree where the dedupe belongs between/u);
    expect(title.getAttribute('title')).toBe(
      'Agree where the dedupe belongs between the webhook handler, the credit writer and the ledger posting in payments-api',
    );
    expect(namesIn({ root: tree }).some((text) => text?.includes('→'))).toBe(true);
  });

  it('turns the time warm on a slow running step without a note word in the row', async () => {
    renderScene('step-rows-runs');

    const tree = await screen.findByTestId('run-tree', undefined, WAIT);

    await waitFor(() => {
      expect(tree.querySelector('[data-testid="work-time"][data-note="true"]')).not.toBeNull();
    }, WAIT);
    expect(within(tree).queryByTestId('timeline-row-state')).toBeNull();
  });

  it('draws the Activity steps with the same grammar and the same columns', async () => {
    const { container } = renderScene('step-rows-activity');

    await waitFor(() => {
      expect(namesIn({ root: container }).length).toBeGreaterThan(2);
    }, WAIT);

    expect(screen.queryByText('Implementer')).toBeNull();
    expect(screen.getAllByRole('img', { name: 'Implementer' }).length).toBeGreaterThan(0);
    expect(effortsIn({ root: container }).length).toBeGreaterThan(0);
  });
});
