// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import { captureLocation } from '../../../../../../store/slices/navigation/captureLocation';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { AUTO_ROOT_ID, IMPLEMENTER_ID } from '../../u24/autoSceneSeed';
import { RUN_AGENT_SCENES } from './run-agent';
import { RUN_TRACE_SCENES } from './run-trace';

const SETTLE_MS = 2_000;

const SCENES = { ...RUN_AGENT_SCENES, ...RUN_TRACE_SCENES };

type MountParams = {
  readonly name: keyof typeof SCENES;
};

type AgentParams = {
  readonly agentId: string;
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async ({ name }: MountParams): Promise<HTMLElement> => {
  const Scene = SCENES[name];
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

const crumbTexts = (): ReadonlyArray<string> =>
  [...document.querySelectorAll('[data-session-crumbs] li')].map((li) => li.textContent ?? '');

const railWordOf = ({ agentId }: AgentParams): string =>
  document
    .querySelector(`[data-lead-tree-agent="${agentId}"]`)
    ?.getAttribute('aria-label')
    ?.split(', ')
    .at(-1) ?? '';

const railRunTitle = (): string => {
  const label =
    document.querySelector('[role="treeitem"][aria-label^="Run, "]')?.getAttribute('aria-label') ??
    '';
  return label.slice('Run, '.length, label.lastIndexOf(', '));
};

const headWord = (): string =>
  document.querySelector('[data-session-head-meta] [role="status"] span')?.textContent ?? '';

const shownStops = (): ReadonlyArray<Element> =>
  [...document.querySelectorAll('button')]
    .filter((button) => button.closest('[inert]') === null)
    .filter((button) => button.textContent?.trim() === 'Stop');

describe('the agent pages of a run', () => {
  it('folds the middle crumbs of a sub agent and keeps Overview and the last two', async () => {
    await mount({ name: 'run-page-subagent' });

    const crumbs = crumbTexts();
    expect(crumbs).toHaveLength(4);
    expect(crumbs[0]).toBe('Overview');
    expect(crumbs[1]).toBe('');
    expect(crumbs[2]).toMatch(/^Implementer · Post one credit per retry/);
    expect(crumbs[3]).toMatch(/^Scout/);

    const fold = screen.getByRole('button', { name: 'Show hidden crumbs' });
    fireEvent.click(fold);
    const menu = screen.getByRole('menu', { name: 'Hidden crumbs' });
    const rows = within(menu).getAllByRole('menuitem');
    expect(rows.map((row) => row.textContent)).toEqual(['Runs', railRunTitle()]);

    fireEvent.click(rows[1] ?? fold);
    const { place } = captureLocation({ state: useAppStore.getState() });
    expect(place.at === 'session' ? place.view.agentId : null).toBe(AUTO_ROOT_ID);
  });

  it('names the run with one label in the crumbs, the run page and the Agents rail', async () => {
    await mount({ name: 'run-page-agent' });
    const runCrumb = crumbTexts()[2];
    const railTitle = railRunTitle();
    cleanup();

    await mount({ name: 'run-page-trace' });

    expect(railTitle).toMatch(/^Why does the ledger retry post a second credit/);
    expect(runCrumb).toBe(railTitle);
    expect(document.querySelector('[data-crumb-current]')?.textContent).toBe(railTitle);
  });

  it('says the state of an agent with the word the Agents rail uses', async () => {
    await mount({ name: 'run-page-agent' });

    expect(headWord()).toBe(railWordOf({ agentId: IMPLEMENTER_ID }));
    const lines = [...document.querySelectorAll('li[data-delegation]')];
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      const word = railWordOf({ agentId: line.getAttribute('data-delegation') ?? '' });
      expect(word).not.toBe('');
      expect(line.textContent).toContain(word);
    }
    expect(lines.map((line) => line.textContent).join(' ')).toContain('Needs you');
    cleanup();

    await mount({ name: 'run-page-subagent' });
    expect(headWord()).toBe('Done');
    expect(railWordOf({ agentId: 'mock-auto-scout-apply' })).toBe('Done');
  });

  it('shows one Stop on a running agent page, in the dock', async () => {
    await mount({ name: 'run-page-agent' });

    const stops = shownStops();
    expect(stops).toHaveLength(1);
    expect(stops[0]?.closest('[data-dock-live]')).not.toBeNull();
  });

  it('shows the model Auto chose for the agent in its composer', async () => {
    await mount({ name: 'run-page-agent' });

    const routing = screen.getByRole('button', { name: /^Model routing: / });
    expect(routing.getAttribute('aria-label')).toContain('Sonnet 5.5');
    expect(routing.textContent).not.toContain('pinned');
  });
});
