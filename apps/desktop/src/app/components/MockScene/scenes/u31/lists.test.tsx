// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U31_LISTS_SCENES } from './lists';

const WAIT = { timeout: 15_000 };

type SceneName = keyof typeof U31_LISTS_SCENES;

beforeAll(async () => {
  installFakeResizeObserver();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type MountParams = {
  readonly name: SceneName;
};

const mount = ({ name }: MountParams) => {
  const Scene = U31_LISTS_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const SCENE_NAMES: ReadonlyArray<SceneName> = [
  'u31-questions',
  'u31-artifacts',
  'u31-question-card',
];

describe('the u31 lists scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U31_LISTS_SCENES)).toEqual(SCENE_NAMES);
    for (const name of SCENE_NAMES) {
      expect(MOCK_SCENES[name]).toBe(U31_LISTS_SCENES[name]);
    }
  });

  it.each(SCENE_NAMES)(
    '%s frames the capture on one 680px element whose padding sits on an inner element',
    async (name) => {
      const { container } = mount({ name });

      await waitFor(() => expect(container.querySelectorAll('[data-shot]')).toHaveLength(1), WAIT);
      const frame = container.querySelector<HTMLElement>('[data-shot]');
      expect(frame?.style.width).toBe('680px');
      expect(frame?.style.padding).toBe('');
      expect(frame?.children).toHaveLength(1);
    },
  );

  it('u31-questions names its groups with level 2 headings and has no answer column', async () => {
    const { container } = mount({ name: 'u31-questions' });

    await screen.findByRole('heading', { level: 2, name: /^Needs you/ }, WAIT);
    screen.getByRole('heading', { level: 2, name: /^Answered/ });
    expect(container.querySelectorAll('[data-list-grid-cell="answer"]')).toHaveLength(0);
  });

  it('u31-questions shows an answer as a second line under its title', async () => {
    const { container } = mount({ name: 'u31-questions' });

    await screen.findByRole('heading', { level: 2, name: /^Answered/ }, WAIT);
    const rows = screen.getAllByRole('button', { name: /, (You|Agent): / });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const stack = row.querySelector('[data-list-grid-cell="question"]')?.firstElementChild;
      expect(stack?.children).toHaveLength(2);
      expect(stack?.children[1]?.textContent).toMatch(/^(You|Agent): /);
    }
    expect(container.querySelectorAll('[data-list-grid-cell="answer"]')).toHaveLength(0);
  });

  it('u31-artifacts names its groups with level 2 headings and states with a 6px dot and no icon', async () => {
    const { container } = mount({ name: 'u31-artifacts' });

    await screen.findByRole('heading', { level: 2, name: /^Needs you/ }, WAIT);
    const states = [
      ...container.querySelectorAll<HTMLElement>('[data-testid="artifact-row-state"]'),
    ];
    expect(states.length).toBeGreaterThan(0);
    for (const state of states) {
      expect(state.querySelectorAll('svg')).toHaveLength(0);
      expect(state.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
      expect(state.children).toHaveLength(2);
    }
  });

  it('u31-question-card holds four option rows, the tag on the top row above the title and one footer row', async () => {
    mount({ name: 'u31-question-card' });

    const card = await screen.findByRole('article', undefined, WAIT);
    expect(within(card).getAllByRole('radio')).toHaveLength(4);
    expect(card.querySelectorAll('[role="radiogroup"] > div')).toHaveLength(4);
    const title = within(card).getByRole('heading', { level: 2 });
    const text = card.textContent ?? '';
    expect(text.indexOf('Blocking')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('Blocking')).toBeLessThan(text.indexOf(title.textContent ?? ''));
    expect(title.textContent).not.toMatch(/Blocking/);
    const footer = card.querySelector('[data-slot="form-actions"]');
    expect(footer?.contains(within(card).getByRole('button', { name: 'Answer' }))).toBe(true);
    expect(footer?.contains(within(card).getByTestId('delegate-answer-row'))).toBe(true);
  });

  it('u31-question-card keeps keys 1 to 4 on the option rows', async () => {
    mount({ name: 'u31-question-card' });

    const card = await screen.findByRole('article', undefined, WAIT);
    const keys = [...card.querySelectorAll('[role="radiogroup"] > div > span[aria-hidden]')].map(
      (key) => key.textContent,
    );
    expect(keys).toEqual(['1', '2', '3', '4']);
    fireEvent.keyDown(card, { key: '2' });
    expect(within(card).getAllByRole('radio')[1]?.getAttribute('aria-checked')).toBe('true');
  });
});
