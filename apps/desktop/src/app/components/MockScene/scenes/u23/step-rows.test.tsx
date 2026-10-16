// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { asCutText, tooltipTextOf } from '../../../../../__tests__/helpers/tooltip';
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

  it('draws the orchestrated steps as a checklist: step, role glyph and word, title, time', async () => {
    renderScene('step-rows-runs');

    const tree = await screen.findByTestId('run-tree', undefined, WAIT);

    expect(within(tree).getAllByText('Implementer').length).toBeGreaterThan(0);
    expect(within(tree).getAllByRole('img', { name: 'Implementer' }).length).toBeGreaterThan(0);
    expect(tree.querySelectorAll('[data-checklist-cell="step"]').length).toBeGreaterThan(0);
    expect(tree.querySelectorAll('[data-checklist-cell="duration"]').length).toBeGreaterThan(0);
    expect(tree.querySelector(MODEL_COLUMN)).toBeNull();
  });

  it('keeps a long title on one line with the whole title in its tooltip', async () => {
    renderScene('step-rows-runs');

    const tree = await screen.findByTestId('run-tree', undefined, WAIT);

    const title = within(tree).getByText(/^Agree where the dedupe belongs between/u);
    expect(tooltipTextOf({ element: asCutText({ element: title }) })).toBe(
      'Agree where the dedupe belongs between the webhook handler, the credit writer and the ledger posting in payments-api',
    );
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
