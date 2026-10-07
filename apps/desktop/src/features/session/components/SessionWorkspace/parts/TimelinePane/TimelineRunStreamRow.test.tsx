// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../../../actions/components/ObjectMenuProvider';
import {
  SESSION,
  SESSION_ID,
  seedActivityRunScene,
} from '../../../../../../app/components/MockScene/scenes/activityRunSeed';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../../store/storyHarness';
import { useAppStore } from '../../../../../../store';
import { TimelinePane } from '.';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const { navigate } = useAppStore.getState();
  seedActivityRunScene();
  useAppStore.setState({ navigate });
});

afterEach(cleanup);

const renderActivity = () =>
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <TimelinePane session={SESSION} actions={null} />
      </ObjectMenuProvider>
    </ToastProvider>,
  );

const runRows = (container: HTMLElement): ReadonlyArray<HTMLElement> =>
  Array.from(container.querySelectorAll<HTMLElement>('[data-row-id^="run:"]'));

const OPENS_RUN = 'Open run, Enter';

const openControlsOf = ({ row }: { readonly row: HTMLElement }): ReadonlyArray<HTMLElement> =>
  within(row)
    .getAllByRole('button')
    .filter((button) => button.getAttribute('aria-description') === OPENS_RUN);

const runIdOf = ({ row }: { readonly row: HTMLElement }): string =>
  (row.getAttribute('data-row-id') ?? '').replace(/^run:/, '');

describe('a run row in Activity', () => {
  it('is one focusable control that says it opens the run', () => {
    const { container } = renderActivity();
    const rows = runRows(container);

    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) {
      const controls = openControlsOf({ row });

      expect(controls).toHaveLength(1);
      expect(controls[0]?.tabIndex).toBe(0);
    }
  });

  it('opens the run page on Enter from the keyboard', async () => {
    const user = userEvent.setup();
    const { container } = renderActivity();
    const [row] = runRows(container);
    const [control] = row === undefined ? [] : openControlsOf({ row });

    control?.focus();
    await user.keyboard('{Enter}');

    expect(useAppStore.getState().activeLens[SESSION_ID]).toBe('workflows');
    expect(useAppStore.getState().focusedWorkflowRunId[SESSION_ID]).toBe(
      row === undefined ? null : runIdOf({ row }),
    );
  });

  it('opens the run page on a click as well', async () => {
    const user = userEvent.setup();
    const { container } = renderActivity();
    const [row] = runRows(container);
    const [control] = row === undefined ? [] : openControlsOf({ row });

    if (control !== undefined) {
      await user.click(control);
    }

    expect(useAppStore.getState().focusedWorkflowRunId[SESSION_ID]).toBe(
      row === undefined ? null : runIdOf({ row }),
    );
  });
});

describe('every clickable row in Activity', () => {
  it('names where it goes, so none is a bare click target', () => {
    const { container } = renderActivity();
    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-row-id]'));
    const controls = rows.flatMap((row) =>
      Array.from(row.querySelectorAll<HTMLElement>('button[aria-description]')),
    );

    expect(controls.length).toBeGreaterThan(3);
    for (const control of controls) {
      expect(control.getAttribute('aria-description')).toMatch(/, Enter$/);
    }
  });
});
