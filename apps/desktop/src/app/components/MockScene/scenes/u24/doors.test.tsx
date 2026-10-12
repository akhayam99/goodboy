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
import { U24_DOORS_SCENES } from './doors';

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
  const Scene = U24_DOORS_SCENES[name];
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

describe('the create entry scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U24_DOORS_SCENES).sort()).toEqual([
      'column-create-draft',
      'column-create-draftopen',
      'column-create-row',
    ]);
    for (const name of Object.keys(U24_DOORS_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(U24_DOORS_SCENES[name]);
    }
  });

  it('column-create-row puts a plus on the Chat and Terminal doors and New session under Sessions', async () => {
    await mount('column-create-row');

    expect(screen.getByRole('button', { name: 'New chat' }).hasAttribute('data-door-create')).toBe(
      true,
    );
    expect(
      screen.getByRole('button', { name: 'New terminal' }).hasAttribute('data-door-create'),
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'New session' }).getAttribute('data-create')).toBe(
      'session',
    );
    expect(document.querySelector('[data-column-create]')).toBeNull();
    expect(document.querySelector('[data-slot="draft-dot"]')).toBeNull();
  });

  it('column-create-draft shows the dot on New session', async () => {
    await mount('column-create-draft');

    const session = screen.getByRole('button', { name: 'New session, Draft in progress' });
    expect(session.querySelector('[data-slot="draft-dot"]')).not.toBeNull();
  });

  it('column-create-draftopen marks New session selected, without a dot', async () => {
    await mount('column-create-draftopen');

    const session = screen.getByRole('button', { name: 'New session' });
    expect(session.getAttribute('aria-current')).toBe('page');
    expect(document.querySelector('[data-slot="draft-dot"]')).toBeNull();
  });

  it.each(Object.keys(U24_DOORS_SCENES))('%s has no accessibility violation', async (name) => {
    const container = await mount(name);
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
