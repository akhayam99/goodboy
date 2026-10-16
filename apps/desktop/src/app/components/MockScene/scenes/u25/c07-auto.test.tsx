// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import {
  registerAutoUserTurnPort,
  type AutoUserTurnPort,
} from '../../../../../features/auto/autoUserTurnPort';
import { MOCK_SCENES } from '../..';
import { U25_C07_AUTO_SCENES } from './c07-auto';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type MountParams = {
  readonly id: keyof typeof U25_C07_AUTO_SCENES;
};

const mount = ({ id }: MountParams): void => {
  const Scene = U25_C07_AUTO_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const levelStack = (): HTMLElement => {
  const stack = document.querySelector<HTMLElement>('[data-level-stack]');
  if (stack === null) {
    throw new Error('no level stack');
  }
  return stack;
};

const shownLayer = (): HTMLElement => {
  const layer = document.querySelector<HTMLElement>(
    `[data-level-layer="${levelStack().dataset.levelStack ?? ''}"]`,
  );
  if (layer === null) {
    throw new Error('no shown layer');
  }
  return layer;
};

describe('c07 Auto scenes', () => {
  it('registers every scene for the capture', () => {
    for (const [id, Scene] of Object.entries(U25_C07_AUTO_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('c07-auto-working drills the sidebar into Auto: back row, work rail, limit foot', async () => {
    mount({ id: 'c07-auto-working' });

    await waitFor(() => expect(levelStack().dataset.levelStack).toBe('auto'), WAIT);
    const level = shownLayer();
    expect(within(level).getByRole('button', { name: /^Back to / })).toBeDefined();
    const rail = within(level).getByRole('list', { name: 'Work' });
    expect(within(rail).getAllByRole('listitem')).toHaveLength(4);
    const foot = within(level).getByRole('region', { name: 'Limit' });
    expect(within(foot).getByRole('button', { name: 'Limit $10.00' })).toBeDefined();
    expect(within(foot).getByText('$5.23 left')).toBeDefined();
  });

  it('c07-auto-working keeps the center lean: no role chip, bare delegation lines, one tail', async () => {
    mount({ id: 'c07-auto-working' });

    await screen.findByRole('button', { name: 'See more about Implementer' }, WAIT);
    const title = screen.getByTestId('agent-header-title-row');
    expect(within(title).queryByText('Auto agent')).toBeNull();
    expect(within(title).queryByText('Experimental')).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.getAllByText('Delegated to').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-auto-tail]')).toHaveLength(1);
    const tail = document.querySelector<HTMLElement>('[data-auto-tail]');
    expect(tail?.textContent).toContain('Waiting for Implementer and Tester');
    expect(screen.queryByRole('button', { name: 'Mark finished' })).toBeNull();
  });

  it('c07-auto-plan asks for the plan approval in the stream with one primary', async () => {
    mount({ id: 'c07-auto-plan' });

    expect(await screen.findByText('Plan v1 needs your approval', undefined, WAIT)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Approve plan' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Ask for changes' })).toBeDefined();
    expect(document.querySelector('[data-auto-tail]')).toBeNull();
  });

  it('c07-auto-idle offers Mark finished in the header and says Idle on the tail', async () => {
    mount({ id: 'c07-auto-idle' });

    expect(await screen.findByRole('button', { name: 'Mark finished' }, WAIT)).toBeDefined();
    const tail = document.querySelector<HTMLElement>('[data-auto-tail]');
    expect(tail?.textContent).toContain('Idle');
  });

  it('c07-auto-child opens the Implementer in the pane with its why, its tail and a composer', async () => {
    mount({ id: 'c07-auto-child' });

    expect(await screen.findByText(/^Why Auto chose Implementer:/, undefined, WAIT)).toBeDefined();
    expect(screen.getByText('Started by Auto. Auto sees what you tell it.')).toBeDefined();
    expect(screen.getByPlaceholderText('Message Implementer')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open full' })).toBeDefined();
    expect(screen.getByText(/Reserved up to \$3\.00/)).toBeDefined();
    const current = within(shownLayer())
      .getAllByRole('listitem')
      .filter((item) => item.getAttribute('aria-current') === 'true');
    expect(current[0]?.textContent).toContain('Implementer');
  });

  it('a rail row and a delegation line open the child pane; the Auto row closes it', async () => {
    mount({ id: 'c07-auto-working' });

    await screen.findByRole('button', { name: 'See more about Tester' }, WAIT);
    fireEvent.click(screen.getByRole('button', { name: 'See more about Tester' }));
    expect(await screen.findByPlaceholderText('Message Tester', undefined, WAIT)).toBeDefined();

    fireEvent.click(within(shownLayer()).getByRole('button', { name: 'Show Implementer' }));
    expect(
      await screen.findByPlaceholderText('Message Implementer', undefined, WAIT),
    ).toBeDefined();

    fireEvent.click(within(shownLayer()).getByRole('button', { name: 'Show Auto' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open full' })).toBeNull());
  });

  it('Open full puts the child in the center and keeps the Auto level with its row selected', async () => {
    mount({ id: 'c07-auto-child' });

    fireEvent.click(await screen.findByRole('button', { name: 'Open full' }, WAIT));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open full' })).toBeNull());
    expect(levelStack().dataset.levelStack).toBe('auto');
    expect(await screen.findByRole('button', { name: 'Open Auto' }, WAIT)).toBeDefined();
  });

  it('c07-auto-child-done shows what came back and says Returned to Auto', async () => {
    mount({ id: 'c07-auto-child-done' });

    expect(await screen.findByText('Returned to Auto', undefined, WAIT)).toBeDefined();
    expect(
      screen.getAllByText('Three tests added in payments-api, all pass.').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('keeps the balance after two attempts')).toBeDefined();
  });

  it('c07-auto-project asks where the Implementer works and names the primary by the choice', async () => {
    mount({ id: 'c07-auto-project' });

    const ask = await screen.findByText('Where should the Implementer work?', undefined, WAIT);
    expect(ask).toBeDefined();
    expect(document.querySelector('[data-auto-tail]')).toBeNull();
    expect(screen.getByPlaceholderText('Pick a project, or write to Auto')).toBeDefined();
    const list = screen.getByRole('list', { name: 'Projects' });
    const boxes = within(list).getAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: 'Choose a project' })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(boxes[0] ?? list);
    expect(screen.getByRole('button', { name: /^Use / })).toHaveProperty('disabled', false);
    fireEvent.click(boxes[1] ?? list);
    expect(screen.getByRole('button', { name: 'Use both' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Another project...' }));
    expect(screen.getByRole('textbox', { name: 'Type a project name' })).toBeDefined();
  });

  it('No project, just answer tells Auto through its door and collapses the ask', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    mount({ id: 'c07-auto-project' });

    fireEvent.click(await screen.findByRole('button', { name: 'No project, just answer' }, WAIT));

    expect(await screen.findByText('Answered: no project', undefined, WAIT)).toBeDefined();
    expect(port).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'No project, just answer in the chat.' }),
    );
    registerAutoUserTurnPort({ port: null });
  });

  it('goes back to the session level with Auto agents selected, and drills in again', async () => {
    mount({ id: 'c07-auto-working' });

    await waitFor(() => expect(levelStack().dataset.levelStack).toBe('auto'), WAIT);
    fireEvent.click(within(shownLayer()).getByRole('button', { name: /^Back to / }));

    await waitFor(() => expect(levelStack().dataset.levelStack).toBe('session'), WAIT);
    const entry = within(shownLayer()).getByRole('button', { name: /Auto agents/ });
    expect(entry.getAttribute('aria-current')).toBe('page');
    expect(within(entry).getByText('Experimental')).toBeDefined();

    fireEvent.click(entry);
    await waitFor(() => expect(levelStack().dataset.levelStack).toBe('auto'), WAIT);
  });

  it('c07-auto-folded shows the Auto level as rings with the back icon first', async () => {
    mount({ id: 'c07-auto-folded' });

    const rail = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-column-rail]');
      expect(found?.dataset.sidebarLevel).toBe('auto');
      return found;
    }, WAIT);
    if (rail === null || rail === undefined) {
      throw new Error('no folded rail');
    }
    expect(within(rail).getByRole('button', { name: /^Back to / })).toBeDefined();
    expect(within(rail).getByRole('button', { name: 'Implementer, Running' })).toBeDefined();
    expect(within(rail).getByRole('button', { name: 'Tester, Queued' })).toBeDefined();
  });

  it('c07-auto-session-level keeps the Auto chat in the center with the session level shown', async () => {
    mount({ id: 'c07-auto-session-level' });

    await waitFor(() => expect(levelStack().dataset.levelStack).toBe('session'), WAIT);
    expect(screen.getByText('Waiting for Implementer and Tester')).toBeDefined();
  });

  it('c07-auto-idle reads Idle on the Auto row of the rail', async () => {
    mount({ id: 'c07-auto-idle' });

    await waitFor(() => expect(levelStack().dataset.levelStack).toBe('auto'), WAIT);
    const rail = within(shownLayer()).getByRole('list', { name: 'Work' });
    expect(within(rail).getByText('Idle')).toBeDefined();
    expect(within(rail).getAllByRole('listitem')).toHaveLength(5);
  });

  it('c07-auto-answering shows Auto alone on the rail with the empty state', async () => {
    mount({ id: 'c07-auto-answering' });

    await waitFor(() => expect(levelStack().dataset.levelStack).toBe('auto'), WAIT);
    const level = shownLayer();
    expect(within(level).getAllByRole('listitem')).toHaveLength(1);
    expect(within(level).getByText('No agents started yet')).toBeDefined();
  });

  it('c07-auto-list lists every Auto conversation on one grid and opens one', async () => {
    mount({ id: 'c07-auto-list' });

    const list = await screen.findByRole('list', { name: 'Auto agents' }, WAIT);
    const rows = within(list).getAllByRole('button');
    expect(rows).toHaveLength(2);
    expect(within(list).getByText('Idle')).toBeDefined();
    expect(within(list).getByText('Finished')).toBeDefined();
    expect(levelStack().dataset.levelStack).toBe('session');

    fireEvent.click(rows[0] ?? list);
    await waitFor(() => expect(levelStack().dataset.levelStack).toBe('auto'), WAIT);
  });

  it('c07-auto-start offers Start Auto with a goal field when the session has none', async () => {
    mount({ id: 'c07-auto-start' });

    const start = await screen.findByRole('region', { name: 'Start Auto' }, WAIT);
    expect(
      within(start).getByText(
        'Ask Auto a question or give it a task. It answers itself, or starts the right agent.',
      ),
    ).toBeDefined();
    expect(within(start).getByRole('button', { name: /Start Auto/ })).toBeDefined();
  });
});
