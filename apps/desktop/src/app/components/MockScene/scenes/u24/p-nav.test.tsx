// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U24_P_NAV_SCENES } from './p-nav';

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
  const Scene = U24_P_NAV_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  const { container } = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

const pinOrder = (): ReadonlyArray<string | null> =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-rail-session]')).map((button) =>
    button.getAttribute('data-rail-session'),
  );

const currentPins = (): ReadonlyArray<string | null> =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-rail-session]'))
    .filter((button) => button.getAttribute('aria-current') === 'page')
    .map((button) => button.getAttribute('data-rail-session'));

describe('the navigation scenes', () => {
  it('registers both scenes for the capture', () => {
    expect(Object.keys(U24_P_NAV_SCENES).sort()).toEqual([
      'integration-issue-focused',
      'railorder',
    ]);
    expect(MOCK_SCENES['integration-issue-focused']).toBe(
      U24_P_NAV_SCENES['integration-issue-focused'],
    );
    expect(MOCK_SCENES.railorder).toBe(U24_P_NAV_SCENES.railorder);
  });

  it('integration-issue-focused holds All issues and Unlink, and no link action', async () => {
    await mount('integration-issue-focused');

    expect(screen.getByRole('button', { name: 'All issues' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Unlink NW-142' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Link/ })).toBeNull();
  });

  it('railorder moves only the frame when another pin is opened', async () => {
    await mount('railorder');
    const order = pinOrder();
    expect(order).toHaveLength(5);
    expect(currentPins()).toEqual([order[1]]);

    fireEvent.click(document.querySelector(`[data-rail-session="${order[3]}"]`) as HTMLElement);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(pinOrder()).toEqual(order);
    expect(currentPins()).toEqual([order[3]]);
  });

  it.each(Object.keys(U24_P_NAV_SCENES))(
    '%s has no accessibility violation once drawn',
    async (name) => {
      const container = await mount(name);
      vi.useRealTimers();

      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
