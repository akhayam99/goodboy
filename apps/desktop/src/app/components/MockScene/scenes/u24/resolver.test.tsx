// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U24_RESOLVER_SCENES } from './resolver';

const SETTLE_MS = 2_000;

beforeAll(async () => {
  await importStore();
  await import('../../../../../features/settings/components/SettingsStudio');
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
  const Scene = U24_RESOLVER_SCENES[name];
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

describe('the resolver scenes', () => {
  it('registers the four scenes for the capture', () => {
    expect(Object.keys(U24_RESOLVER_SCENES).sort()).toEqual([
      'models-anthropic-on',
      'models-anthropic-sized',
      'models-anthropic-tasks',
      'models-codex-only',
    ]);
    expect(MOCK_SCENES['models-codex-only']).toBe(U24_RESOLVER_SCENES['models-codex-only']);
  });

  it('models-codex-only says why each Claude pin is skipped', async () => {
    await mount('models-codex-only');

    expect(
      screen.getAllByRole('img', { name: /^Pinned Opus 5\.5 is skipped: Claude is Off\. Using / })
        .length,
    ).toBe(4);
    expect(
      screen.getAllByRole('img', { name: /^Pinned Sonnet 5 is skipped: Claude is Off\. Using / })
        .length,
    ).toBe(1);
    expect(screen.queryByText(/A project setting/)).toBeNull();
  });

  it('models-anthropic-on runs the pins and prints no project line', async () => {
    await mount('models-anthropic-on');

    expect(screen.queryByText(/is skipped/)).toBeNull();
    expect(screen.queryByText(/A project setting/)).toBeNull();
    const summaries = Array.from(
      document.querySelectorAll<HTMLElement>('[data-role-summary]'),
    ).filter((summary) => summary.textContent === 'Opus 5.5');
    expect(summaries.length).toBe(4);
  });

  it('models-anthropic-sized opens Implementer and reads what each step size runs', async () => {
    await mount('models-anthropic-sized');

    expect(
      screen.queryByText(
        'Auto sizes it by the step: small Haiku 5.5 Medium, normal Sonnet 5.5 Medium, large Sonnet 5.5 High.',
      ),
    ).not.toBeNull();
  });

  it('models-anthropic-tasks names Haiku 5.5 on the closed trigger of a writing task', async () => {
    await mount('models-anthropic-tasks');

    const section = screen.getByRole('region', { name: 'Background tasks' });
    const trigger = Array.from(section.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label')?.startsWith('Agent naming routing:') === true,
    );

    expect(trigger?.textContent).toContain('Haiku 5.5');
    expect(trigger?.textContent).toContain('Low');
  });

  it('models-anthropic-on names the model Auto runs on every background task row', async () => {
    await mount('models-anthropic-on');

    expect(screen.queryByText('Choosing models')).not.toBeNull();
    expect(screen.queryByText('Models in workflows')).not.toBeNull();
    expect(screen.queryByText('Typed requests')).not.toBeNull();
  });

  it.each(Object.keys(U24_RESOLVER_SCENES))(
    '%s has no accessibility violation once drawn',
    async (name) => {
      const container = await mount(name);
      vi.useRealTimers();

      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
