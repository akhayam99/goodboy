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

const rail = () => screen.getByRole('list', { name: 'Work' });

const limitFoot = () => screen.getByRole('region', { name: 'Limit' });

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
    expect(within(rail()).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('No agents started yet')).toBeDefined();
    expect(screen.queryByRole('article')).toBeNull();
    expect(
      within(screen.getByTestId('agent-header-title-row')).queryByText('Experimental'),
    ).toBeNull();
  });

  it('auto-chat-delegating shows Auto and the Planner on one rail, one card and the wait strip', async () => {
    mount({ id: 'auto-chat-delegating' });

    expect(await screen.findByRole('article', { name: 'Planner delegation' }, WAIT)).toBeDefined();
    const work = rail();
    expect(within(work).getAllByRole('listitem')).toHaveLength(2);
    expect(within(work).getByText('Starting')).toBeDefined();
    expect(screen.getByText('Waiting for Planner')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Change approach' })).toBeDefined();
    const strip = screen.getByText('Waiting for Planner').closest('[role="status"]');
    if (!(strip instanceof HTMLElement)) {
      throw new Error('no wait strip');
    }
    expect(within(strip).getByRole('button', { name: /Stop/ })).toBeDefined();
    expect(screen.getByText('Reserved up to $0.75')).toBeDefined();
  });

  it('auto-chat-plan asks for approval in the drawer and keeps the rail whole', async () => {
    mount({ id: 'auto-chat-plan' });

    const toolbar = await screen.findByTestId('auto-plan-toolbar', undefined, WAIT);
    expect(within(toolbar).getByText('Needs approval')).toBeDefined();
    expect(within(toolbar).getByRole('button', { name: /Approve plan/ })).toBeDefined();
    expect(within(toolbar).getByRole('button', { name: /Ask for changes/ })).toBeDefined();
    expect(within(rail()).getByText('Needs your approval')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Open plan Retry-safe credit retries' }),
    ).toBeDefined();
  });

  it('auto-chat-working has every child expanded and the budget numbers of one function', async () => {
    mount({ id: 'auto-chat-working' });

    expect(
      await screen.findByRole('article', { name: 'Implementer delegation' }, WAIT),
    ).toBeDefined();
    const work = rail();
    expect(within(work).getAllByRole('listitem')).toHaveLength(4);
    expect(within(work).queryByText(/subagents/i)).toBeNull();
    expect(screen.getByText('Waiting for Implementer and Tester')).toBeDefined();
    expect(screen.getByText('Reserved up to $3.00')).toBeDefined();
    expect(screen.getByText('Reserved up to $1.50')).toBeDefined();
    const foot = limitFoot();
    expect(within(foot).getByRole('button', { name: 'Limit $10.00' })).toBeDefined();
    expect(within(foot).getByText('$5.23 left')).toBeDefined();
    expect(within(foot).queryByText(/Spent|Reserved/)).toBeNull();
  });

  it('auto-chat-working opens the limit popover from the rail foot', async () => {
    mount({ id: 'auto-chat-working' });

    await screen.findByRole('article', { name: 'Implementer delegation' }, WAIT);
    fireEvent.click(within(limitFoot()).getByRole('button', { name: 'Limit $10.00' }));

    const popover = screen.getByRole('dialog', { name: 'Limit for this conversation' });
    expect(within(popover).getByText('Spent $0.27, reserved $4.50')).toBeDefined();
    expect(within(popover).getByRole('button', { name: '$10' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(within(popover).getByRole('button', { name: 'Custom' }));
    fireEvent.change(within(popover).getByLabelText('Custom limit in dollars'), {
      target: { value: '4' },
    });
    expect(
      within(popover).getByText('The limit must cover spent and reserved usage.'),
    ).toBeDefined();
  });

  it('auto-chat-nocap reads No cap in the foot with what is spent and no left', async () => {
    mount({ id: 'auto-chat-nocap' });

    await screen.findByRole('article', { name: 'Implementer delegation' }, WAIT);
    const foot = limitFoot();
    expect(within(foot).getByRole('button', { name: 'No cap' })).toBeDefined();
    expect(within(foot).getByText('$0.27 spent')).toBeDefined();
    expect(within(foot).queryByText(/left/)).toBeNull();
  });

  it('auto-chat-revising shows the revision on the same Planner', async () => {
    mount({ id: 'auto-chat-revising' });

    expect(
      await screen.findByRole('article', { name: 'Planner, revising v2 delegation' }, WAIT),
    ).toBeDefined();
    expect(within(rail()).getAllByText('Planner')).toHaveLength(1);
  });

  it('auto-chat-confirm asks before the revise starts', async () => {
    mount({ id: 'auto-chat-confirm' });

    expect(
      await screen.findByText('Change plan Retry-safe credit retries at v1?', undefined, WAIT),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
  });

  it('auto-chat-refused says which agent was not started and why, in the wait strip', async () => {
    mount({ id: 'auto-chat-refused' });

    const notice = await screen.findByText(
      'Auto tried to start an Implementer. Not started: more than one project fits and it did not say which. Auto is choosing again.',
      undefined,
      WAIT,
    );
    expect(notice.closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByText('Auto is reading the results')).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('auto-chat-done lists every child as done and has no wait strip', async () => {
    mount({ id: 'auto-chat-done' });

    expect(await screen.findByRole('article', { name: 'Reviewer delegation' }, WAIT)).toBeDefined();
    expect(within(rail()).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.queryByRole('button', { name: 'Change approach' })).toBeNull();
    expect(screen.getByText('3 files changed')).toBeDefined();
    expect(screen.getByText('keeps the balance after two attempts')).toBeDefined();
    expect(within(limitFoot()).getByText('$9.47 left')).toBeDefined();
  });

  it('auto-chat-done says Idle in the rail and offers Mark finished', async () => {
    mount({ id: 'auto-chat-done' });

    await screen.findByRole('article', { name: 'Reviewer delegation' }, WAIT);
    expect(within(rail()).getByText('Idle')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'More agent actions' }));
    expect(await screen.findByRole('menuitem', { name: /Mark finished/ }, WAIT)).toBeDefined();
  });

  it('auto-chat-finished says Finished and no longer offers Mark finished', async () => {
    mount({ id: 'auto-chat-finished' });

    await screen.findByRole('article', { name: 'Reviewer delegation' }, WAIT);
    expect(within(rail()).getByText('Finished')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'More agent actions' }));
    await screen.findAllByRole('menuitem', undefined, WAIT);
    expect(screen.queryByRole('menuitem', { name: /Mark finished/ })).toBeNull();
  });

  it('auto-chat-child reads the Planner started by Auto, with no composer', async () => {
    mount({ id: 'auto-chat-child' });

    expect(
      await screen.findByText(
        'Started by Auto. You can read and stop it here. To change what it does, tell Auto.',
        undefined,
        WAIT,
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open Auto' })).toBeDefined();
  });

  it('auto-overview-row draws one row for the tree and none for its children', async () => {
    mount({ id: 'auto-overview-row' });

    expect(await screen.findByText('Auto', undefined, WAIT)).toBeDefined();
    expect(screen.getByText('Waiting for Implementer and Tester')).toBeDefined();
    expect(screen.queryByText('Implementer')).toBeNull();
    expect(screen.queryByText('Tester')).toBeNull();
  });
});
