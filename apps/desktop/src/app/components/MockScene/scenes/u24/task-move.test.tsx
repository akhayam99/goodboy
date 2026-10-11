// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U24_TASK_MOVE_SCENES } from './task-move';

const SETTLE_MS = 2_000;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: string): Promise<Element> => {
  const Scene = U24_TASK_MOVE_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  const { container } = render(
    <ToastProvider>
      <ObjectMenuProvider>
        <Scene />
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

describe('the task move scenes', () => {
  it('registers both scenes for the capture', () => {
    expect(Object.keys(U24_TASK_MOVE_SCENES).sort()).toEqual([
      'taskmove-issuepage',
      'taskmove-menu',
    ]);
    expect(MOCK_SCENES['taskmove-menu']).toBe(U24_TASK_MOVE_SCENES['taskmove-menu']);
    expect(MOCK_SCENES['taskmove-issuepage']).toBe(U24_TASK_MOVE_SCENES['taskmove-issuepage']);
  });

  it('taskmove-menu opens Move to on the chip with the current placement checked', async () => {
    await mount('taskmove-menu');

    const menu = screen.getByRole('menu', { name: 'Move to' });
    const choices = within(menu).getAllByRole('menuitemradio');
    expect(choices.length).toBeGreaterThanOrEqual(2);
    expect(choices[0]?.textContent).toContain('This session');
    expect(choices[0]?.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menu', { name: 'Task actions' })).toBeDefined();
  });

  it('taskmove-issuepage shows Linked to with the branch the issue sits on, under the issue header', async () => {
    await mount('taskmove-issuepage');

    expect(screen.getByText('Linked to')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Move NW-142 from api · feat/create-orders-endpoint' }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'All issues' })).toBeDefined();
  });

  it.each(Object.keys(U24_TASK_MOVE_SCENES))(
    '%s has no accessibility violation once drawn',
    async (name) => {
      const container = await mount(name);
      vi.useRealTimers();

      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
