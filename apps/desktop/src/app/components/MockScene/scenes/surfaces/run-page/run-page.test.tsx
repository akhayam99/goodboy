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
} from '../../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { RUN_PAGE_SCENES } from './run-page';

const SETTLE_MS = 2_000;

type MountParams = {
  readonly name: keyof typeof RUN_PAGE_SCENES;
};

beforeAll(async () => {
  await importStore();
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
  const Scene = RUN_PAGE_SCENES[name];
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

type PartParams = {
  readonly root: Element;
  readonly selector: string;
};

const partOf = ({ root, selector }: PartParams): HTMLElement => {
  const part = root.querySelector<HTMLElement>(selector);
  if (part === null) {
    throw new Error(`no ${selector}`);
  }
  return part;
};

describe('the run page scenes', () => {
  it('run-page-plan draws one head: the run name is the last crumb, its status line under it', async () => {
    const container = await mount({ name: 'run-page-plan' });
    const head = partOf({ root: container, selector: '[data-session-head]' });

    expect(head.getAttribute('data-head-nav')).toBe('crumbs');
    const shownHeaders = [...container.querySelectorAll('[data-page-header]')].filter(
      (header) => header.closest('[inert]') === null,
    );
    expect(shownHeaders).toHaveLength(0);
    const titles = [...container.querySelectorAll('h1')].filter(
      (title) => title.closest('[inert]') === null,
    );
    expect(titles).toHaveLength(1);
    const current = head.querySelector('[data-crumb-current]');
    expect(current?.textContent).toMatch(/^Why does the ledger retry post a second credit/);
    const meta = partOf({ root: head, selector: '[data-session-head-meta]' });
    expect(meta.querySelector('[data-glance-place="head"]')).not.toBeNull();
    expect(within(meta).queryByRole('button', { name: 'Run settings' })).toBeNull();
    const facts = within(meta).getByRole('group', { name: 'Run settings' });
    expect(within(facts).getByRole('button', { name: /^Edits: / }).textContent).toBe('Ask first');
    expect(container.querySelectorAll('[data-glance]')).toHaveLength(1);
  });

  it('run-head-menu says the Lead settings as words and opens the stop rule as one menu', async () => {
    const container = await mount({ name: 'run-head-menu' });
    const meta = partOf({ root: container, selector: '[data-session-head-meta]' });
    const facts = within(meta).getByRole('group', { name: 'Run settings' });
    const stops = within(facts).getByRole('button', { name: 'Stops for your OK: After the plan' });

    expect(stops.textContent).toBe('Stops after the plan');
    expect(within(facts).getByRole('button', { name: /^Limit: / }).textContent).toBe(
      'Limit $10.00',
    );
    if (stops.getAttribute('aria-expanded') !== 'true') {
      fireEvent.click(stops);
    }
    expect(stops.getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByRole('menu', { name: 'Stops for your OK' });
    expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(3);
    expect(container.querySelector('[data-session-head] .bg-subtle.rounded-lg')).toBeNull();
  });

  it('run-page-many puts the Agents rail in the left slot, the run first, counting every agent once', async () => {
    const container = await mount({ name: 'run-page-many' });

    const lead = partOf({ root: container, selector: '[data-session-lead]' });
    expect(partOf({ root: container, selector: '[data-session-aside]' }).childElementCount).toBe(0);
    const rail = within(lead).getByRole('complementary', { name: 'Agents' });
    within(rail).getByRole('heading', { name: 'Agents' });
    expect(rail.querySelector('[data-lead-rail-head]')?.textContent).toBe('Agents3');
    const rows = within(rail).getAllByRole('treeitem');
    expect(rows).toHaveLength(4);
    expect(rows[0]?.getAttribute('aria-label')).toMatch(/^Run, /);
    expect(rows[0]?.getAttribute('aria-selected')).toBe('true');
  });

  it('run-page-plan says the state of a one agent plan card once, on its row', async () => {
    await mount({ name: 'run-page-plan' });

    const card = screen.getByRole('group', { name: 'Plan' });
    expect(within(card).getAllByText('Done')).toHaveLength(1);
  });

  it('run-page-lead-next lists the choices one per row under a title with no raw id, one primary', async () => {
    const container = await mount({ name: 'run-page-lead-next' });

    const next = screen.getByRole('region', { name: 'Next step' });
    expect(next.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
    const list = within(next).getByRole('listbox', { name: 'Next step choices' });
    expect(list.getAttribute('aria-orientation')).toBe('vertical');
    expect(within(list).getAllByRole('option')).toHaveLength(3);
    expect(within(list).getAllByText('Recommended')).toHaveLength(1);
    within(next).getByRole('button', { name: 'Continue' });
    const rail = partOf({ root: container, selector: '[data-run-agents-rail]' });
    expect(rail.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
    screen.getByPlaceholderText('Message Lead, or describe changes to plan v1');
  });

  it('run-page-lead-working puts Stop with the run controls in the head and says the state once', async () => {
    const container = await mount({ name: 'run-page-lead-working' });
    const meta = partOf({ root: container, selector: '[data-session-head-meta]' });

    within(meta).getByRole('button', { name: 'Stop run' });
    expect(screen.getAllByRole('button', { name: /^Stop (?:run|Lead)/ })).toHaveLength(1);
    expect(meta.querySelectorAll('[data-lead-state]')).toHaveLength(1);
    expect(meta.querySelector('[data-run-kind-line]')?.textContent).toBe('Lead');
    expect(meta.textContent).not.toMatch(/Auto/);
    screen.getByPlaceholderText('Message Lead');
  });
});
