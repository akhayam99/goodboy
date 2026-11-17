// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U48_ITEM_WORK_SCENES } from './item-work';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(() => {
  cleanup();
});

type RowParams = {
  readonly id: string;
};

const rowOf = ({ id }: RowParams): HTMLElement => {
  const row = document.querySelector<HTMLElement>(`[data-scene-row="${id}"]`);
  if (row === null) {
    throw new Error(`No scene row ${id}`);
  }
  return row;
};

describe('u48 item work scenes', () => {
  it('registers both themes', () => {
    for (const [id, scene] of Object.entries(U48_ITEM_WORK_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(scene);
    }
  });

  it('reads each row in the dictionary words, with the step from the transcript', () => {
    const Scene = U48_ITEM_WORK_SCENES['u48-item-work-line'];
    render(<Scene />);

    const analyzing = within(rowOf({ id: 'analyzing' }));
    expect(analyzing.getByRole('status').textContent).toContain('Analyzing');
    analyzing.getByText('Reading retryPolicy.ts');
    analyzing.getByRole('button', { name: 'Stop' });
    analyzing.getByRole('button', { name: 'Open transcript' });

    within(rowOf({ id: 'fixing' })).getByText('Running pnpm test metrics');
    within(rowOf({ id: 'in-run' })).getByText('Moving the constant into config.ts');
    within(rowOf({ id: 'cause-found' })).getByRole('button', { name: 'Review fix' });
    expect(within(rowOf({ id: 'failed' })).getByRole('alert').textContent).toContain('Failed');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('keeps the clicked button busy while the item says Starting', () => {
    const Scene = U48_ITEM_WORK_SCENES['u48-item-work-line'];
    render(<Scene />);

    const starting = rowOf({ id: 'starting' });
    expect(within(starting).getByRole('status').textContent).toContain('Starting');
    expect(
      within(starting)
        .getByRole('button', { name: /Analyze/ })
        .getAttribute('aria-busy'),
    ).toBe('true');
  });

  it('shows active time on live rows and the frozen time on a waiting one', () => {
    const Scene = U48_ITEM_WORK_SCENES['u48-item-work-line'];
    render(<Scene />);

    const clockOf = ({ id }: RowParams): string | null =>
      rowOf({ id }).querySelector('[data-item-work-clock]')?.textContent ?? null;
    expect(clockOf({ id: 'analyzing' })).not.toBeNull();
    expect(clockOf({ id: 'waiting' })).not.toBeNull();
    expect(clockOf({ id: 'cause-found' })).toBeNull();
  });
});
