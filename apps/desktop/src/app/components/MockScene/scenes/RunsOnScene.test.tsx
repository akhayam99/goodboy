// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../shared/components/Toast';
import { currentPlatform } from '../../../../shared/platform';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { UndoToastBridge } from '../../UndoToastBridge';
import { RunsOnScene } from './RunsOnScene';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const mount = async () => {
  render(
    <ToastProvider>
      <UndoToastBridge />
      <RunsOnScene />
    </ToastProvider>,
  );
  await screen.findByTestId('next-step-check-changes:ledger-core');
};

const row = (id: string) => screen.getByTestId(`next-step-${id}:ledger-core`);

const tileKind = (id: string) =>
  row(id).querySelector('[data-column="tile"]')?.getAttribute('data-agent-kind') ?? null;

describe('the runs-on-codex-default scene', () => {
  it('draws the role of each agent suggestion on its tile and leaves the others alone', async () => {
    await mount();

    expect(tileKind('check-changes')).toBe('reviewer');
    expect(tileKind('fix-checks')).toBe('debugger');
    expect(tileKind('resolve-threads')).toBeNull();
    expect(tileKind('push-branch')).toBeNull();
  });

  it('shows short verbs, keeps the full action names, and fills no primary', async () => {
    await mount();

    const reviewer = screen.getByRole('button', { name: 'Start reviewer' });
    expect(reviewer.textContent).toBe('Start');
    expect(screen.getByRole('button', { name: 'Analyze' }).textContent).toBe('Analyze');
    const variants = ['Fix 3', 'Start reviewer', 'Analyze', 'Push'].map((name) =>
      screen.getByRole('button', { name }).getAttribute('data-variant'),
    );
    expect(variants).toEqual(['secondary', 'secondary', 'secondary', 'secondary']);
  });

  it('puts Not now and the more menu in the same columns on every card', async () => {
    await mount();

    for (const column of ['primary', 'not-now', 'menu']) {
      const classes = ['resolve-threads', 'check-changes', 'fix-checks', 'push-branch'].map(
        (id) => row(id).querySelector(`[data-column="${column}"]`)?.className,
      );
      expect(new Set(classes).size).toBe(1);
      expect(classes[0]).toBeDefined();
    }
  });

  it('lists the alternatives in the more menu and previews their role on the tile', async () => {
    await mount();
    expect(screen.queryByRole('button', { name: /Start tester instead/ })).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'More options for Check the changes before you push' }),
    );
    const tester = screen.getByRole('menuitem', { name: /Start tester instead/ });
    screen.getByRole('menuitem', { name: /Start implementer instead/ });
    fireEvent.mouseEnter(tester);

    expect(tileKind('check-changes')).toBe('tester');
    fireEvent.mouseLeave(tester);
    expect(tileKind('check-changes')).toBe('reviewer');
  });

  it('dismisses with Not now and brings the card back with the undo chord', async () => {
    await mount();

    const [lead] = screen.getAllByRole('button', { name: 'Not now' });
    if (lead === undefined) {
      throw new Error('Expected a Not now button');
    }
    fireEvent.click(lead);
    expect(screen.queryByText('3 review comments to resolve')).toBeNull();
    screen.getByText('Dismissed');
    expect(
      screen.getByRole('button', { name: 'Start reviewer' }).getAttribute('data-variant'),
    ).toBe('secondary');

    await act(async () => {
      fireEvent.keyDown(document.body, {
        code: 'KeyZ',
        key: 'z',
        metaKey: currentPlatform() === 'darwin',
        ctrlKey: currentPlatform() !== 'darwin',
      });
    });

    screen.getByText('3 review comments to resolve');
    expect(screen.getByRole('button', { name: 'Fix 3' }).getAttribute('data-variant')).toBe(
      'secondary',
    );
  });
});
