// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U24_AUTO_CHAT_SCENES } from './auto-chat';

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

const mount = ({ id }: { readonly id: string }): void => {
  const Scene = U24_AUTO_CHAT_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const rail = () => screen.getByRole('tree', { name: 'Auto agents' });

const railLabels = (): ReadonlyArray<string> =>
  within(rail())
    .getAllByRole('treeitem')
    .map((item) => item.getAttribute('aria-label') ?? '');

const limitChip = () => screen.getByRole('button', { name: /^Limit: / });

describe('the Auto chat scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U24_AUTO_CHAT_SCENES).sort()).toEqual([
      'auto-chat-answering',
      'auto-chat-child',
      'auto-chat-confirm',
      'auto-chat-delegating',
      'auto-chat-done',
      'auto-chat-finished',
      'auto-chat-nocap',
      'auto-chat-plan',
      'auto-chat-queued',
      'auto-chat-refused',
      'auto-chat-revising',
      'auto-chat-working',
      'auto-overview-row',
    ]);
    for (const [id, Scene] of Object.entries(U24_AUTO_CHAT_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('auto-chat-answering keeps the Work rail with Auto alone, its empty state and no card', async () => {
    mount({ id: 'auto-chat-answering' });

    expect(
      await screen.findByText(/Retries are posted by postCredit/, undefined, WAIT),
    ).toBeDefined();
    expect(rail().querySelectorAll('[data-agent-id]')).toHaveLength(1);
    expect(screen.getByText('No agents started yet')).toBeDefined();
    expect(screen.queryByRole('article')).toBeNull();
    expect(
      within(screen.getByTestId('agent-header-title-row')).queryByText('Experimental'),
    ).toBeNull();
  });

  it('auto-chat-delegating shows Auto and the Planner on one rail, one line and the tail', async () => {
    mount({ id: 'auto-chat-delegating' });

    expect(
      (await screen.findAllByRole('list', { name: 'Delegations' }, WAIT)).length,
    ).toBeGreaterThan(0);
    const work = rail();
    expect(work.querySelectorAll('[data-agent-id]')).toHaveLength(2);
    expect(railLabels().some((label) => label.endsWith('Starting'))).toBe(true);
    expect(screen.queryByRole('article')).toBeNull();
    const tail = screen.getByText('Starting agents').closest('[role="status"]');
    if (!(tail instanceof HTMLElement)) {
      throw new Error('no tail');
    }
    expect(within(tail).getByRole('button', { name: /^Stop/ })).toBeDefined();
  });

  it('auto-chat-plan asks for approval in the reader pane and folds the rail beside it', async () => {
    mount({ id: 'auto-chat-plan' });

    const toolbar = await screen.findByTestId('auto-plan-toolbar', undefined, WAIT);
    expect(within(toolbar).getByText('Needs approval')).toBeDefined();
    expect(within(toolbar).getByRole('button', { name: /Approve plan/ })).toBeDefined();
    expect(within(toolbar).getByRole('button', { name: /Ask for changes/ })).toBeDefined();
    const sidebar = screen.getByRole('navigation', { name: 'Sidebar' });
    expect(sidebar.childElementCount).toBe(0);
    expect(within(sidebar).queryByRole('tree')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Open plan Retry-safe credit retries' }),
    ).toBeDefined();
  });

  it('auto-chat-working has every child expanded and the budget numbers of one function', async () => {
    mount({ id: 'auto-chat-working' });

    expect(
      (await screen.findAllByRole('list', { name: 'Delegations' }, WAIT)).length,
    ).toBeGreaterThan(0);
    const work = rail();
    expect(work.querySelectorAll('[data-agent-id]')).toHaveLength(3);
    expect(within(work).queryByText(/subagents/i)).toBeNull();
    expect(screen.getByText('Waiting for Implementer and Tester')).toBeDefined();
    expect(screen.queryByText(/Reserved up to/)).toBeNull();
    expect(limitChip().getAttribute('aria-label')).toMatch(/^Limit: \$0\.27 of \$10\.00/);
    expect(limitChip().textContent).not.toMatch(/Spent|Reserved/);
  });

  it('auto-chat-queued says under the bubble that the message waits, with Send now', async () => {
    mount({ id: 'auto-chat-queued' });

    expect(
      await screen.findByText('Also keep the retry window at 30 seconds.', undefined, WAIT),
    ).toBeDefined();
    const line = document.querySelector('[data-auto-pending-message]');
    if (!(line instanceof HTMLElement)) {
      throw new Error('no pending line');
    }
    expect(line.textContent).toMatch(/^Waits for /);
    expect(within(line).getAllByRole('button')).toHaveLength(1);
    expect(within(line).getAllByRole('button')[0]?.textContent).toBe('Send now');
    expect(document.querySelectorAll('[data-auto-pending-message]')).toHaveLength(1);
  });

  it('auto-chat-working opens the limit popover from the chip line', async () => {
    mount({ id: 'auto-chat-working' });

    await screen.findAllByRole('list', { name: 'Delegations' }, WAIT);
    fireEvent.click(limitChip());

    const popover = screen.getByRole('dialog', { name: 'Limit' });
    expect(within(popover).getByText('$0.27')).toBeDefined();
    expect(within(popover).getByText('$4.50')).toBeDefined();
    expect(within(popover).getByRole('form', { name: 'Limit for this Auto' })).toBeDefined();
    expect(popover.textContent).toContain('comes first');
  });

  it('auto-chat-nocap reads what is spent on the chip and no left', async () => {
    mount({ id: 'auto-chat-nocap' });

    await screen.findAllByRole('list', { name: 'Delegations' }, WAIT);
    expect(limitChip().getAttribute('aria-label')).toMatch(/^Limit: \$0\.27 spent/);
    expect(limitChip().textContent).not.toMatch(/left/);
  });

  it('auto-chat-revising shows the revision on the same Planner', async () => {
    mount({ id: 'auto-chat-revising' });

    expect(await screen.findByText('revising v2', undefined, WAIT)).toBeDefined();
    expect(within(rail()).getAllByRole('img', { name: 'Planner' })).toHaveLength(1);
  });

  it('auto-chat-confirm asks before the revise starts', async () => {
    mount({ id: 'auto-chat-confirm' });

    const card = await screen.findByRole('region', { name: 'Next step' }, WAIT);
    expect(
      within(card).getAllByText('Revise Retry-safe credit retries to v2').length,
    ).toBeGreaterThan(0);
    expect(within(card).getByRole('button', { name: 'Not now' })).toBeDefined();
  });

  it('auto-chat-refused turns a refused hand over into the project ask, nothing started', async () => {
    mount({ id: 'auto-chat-refused' });

    expect(
      await screen.findByText('Where should the Implementer work?', undefined, WAIT),
    ).toBeDefined();
    expect(screen.queryByText('Auto is reading the results')).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.queryByText('Delegated to')).toBeNull();
  });

  it('auto-chat-done lists every child as done and has no waiting tail', async () => {
    mount({ id: 'auto-chat-done' });

    expect(
      (await screen.findAllByRole('list', { name: 'Delegations' }, WAIT)).length,
    ).toBeGreaterThan(0);
    expect(railLabels().filter((label) => label.endsWith(', Idle'))).toHaveLength(1);
    expect(rail().querySelectorAll('[data-agent-id]')).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: /^Open (?!plan )/ })).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Change approach' })).toBeNull();
    expect(limitChip().getAttribute('aria-label')).toMatch(/^Limit: \$0\.53 of \$10\.00/);
  });

  it('auto-chat-done says Idle in the rail with no tail, and Mark finished in the header once', async () => {
    mount({ id: 'auto-chat-done' });

    await screen.findAllByRole('list', { name: 'Delegations' }, WAIT);
    expect(railLabels().some((label) => label.endsWith('Idle'))).toBe(true);
    expect(document.querySelector('[data-auto-tail]')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Mark finished' }, WAIT)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'More agent actions' }));
    await screen.findAllByRole('menuitem', undefined, WAIT);
    expect(screen.queryByRole('menuitem', { name: /Mark finished/ })).toBeNull();
  });

  it('auto-chat-finished says Done with no tail and no longer offers Mark finished', async () => {
    mount({ id: 'auto-chat-finished' });

    await screen.findAllByRole('list', { name: 'Delegations' }, WAIT);
    expect(railLabels().some((label) => label.endsWith('Done'))).toBe(true);
    expect(screen.queryByText('Finished. Write to reopen.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark finished' })).toBeNull();
  });

  it('auto-chat-child reads the Planner started by Auto, with a composer Auto hears', async () => {
    mount({ id: 'auto-chat-child' });

    expect(
      await screen.findByText('Started by Auto. Auto sees what you tell it.', undefined, WAIT),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open Auto' })).toBeDefined();
    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('auto-overview-row draws the Auto tree once in Running, its agents under it', async () => {
    mount({ id: 'auto-overview-row' });

    const running = await screen.findByRole('region', { name: 'Running' }, WAIT);
    expect(within(running).getByText('Waiting for Implementer and Tester')).toBeDefined();
    expect(within(running).getAllByRole('button', { name: 'Open Auto chat' })).toHaveLength(1);
    expect(running.textContent).toContain(
      'Post one credit per retry in postCredit and applyCredit',
    );
  });
});
