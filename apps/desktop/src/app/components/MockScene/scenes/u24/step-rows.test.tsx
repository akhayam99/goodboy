// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U24_STEP_ROWS_SCENES } from './step-rows';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const renderScene = () => {
  const Scene = U24_STEP_ROWS_SCENES['steprows-models'];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const rowOf = ({ id }: { readonly id: string }): HTMLElement => {
  const row = document.querySelector<HTMLElement>(`[data-row-id="${id}"]`);
  if (row === null) {
    throw new Error(`no row ${id}`);
  }
  return row;
};

const partOf = ({ id, part }: { readonly id: string; readonly part: 'name' | 'detail' }) =>
  rowOf({ id }).querySelector(`[data-routing-part="${part}"]`)?.textContent ?? null;

describe('the step rows models scene', () => {
  it('is registered under its id', () => {
    expect(Object.keys(MOCK_SCENES)).toContain('steprows-models');
  });

  it('puts the model on top and the variant and effort below', () => {
    renderScene();

    expect(partOf({ id: 'one', part: 'name' })).toBe('Sonnet 5.5');
    expect(partOf({ id: 'one', part: 'detail' })).toBe('High');
    expect(partOf({ id: 'cursor', part: 'detail' })).toBe('Thinking · High');
  });

  it('states several models as the one it ended on, a count, or the busiest plus the rest', () => {
    renderScene();

    expect(partOf({ id: 'two', part: 'name' })).toBe('Sonnet 5.5');
    expect(partOf({ id: 'two', part: 'detail' })).toBe('from Kimi K3');
    expect(partOf({ id: 'three', part: 'name' })).toBe('3 models');
    expect(partOf({ id: 'run', part: 'name' })).toBe('Sonnet 5.5');
    expect(partOf({ id: 'run', part: 'detail' })).toBe('+ 5 models');
  });

  it('gives every row the same columns and an Answer only where one is asked', () => {
    renderScene();

    for (const id of ['one', 'planned', 'long', 'answer', 'none']) {
      const row = rowOf({ id });
      expect(row.querySelector('[data-meta-column="model"]')).not.toBeNull();
      expect(row.querySelector('[data-meta-column="stack"]')).not.toBeNull();
      expect(row.querySelector('[data-meta-column="action"]')).not.toBeNull();
    }
    expect(screen.getAllByRole('button', { name: 'Answer' })).toHaveLength(1);
    expect(rowOf({ id: 'none' }).querySelector('[data-routing-part]')).toBeNull();
  });
});
