// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { U24_AUTO_CHAT_SCENES } from '../u24/auto-chat';
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
  readonly Scene: ComponentType | undefined;
};

const mount = ({ Scene }: MountParams): void => {
  if (Scene === undefined) {
    throw new Error('no scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const autoLevel = async (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: 'Agents' }, WAIT);

describe('SPEC3 9.5 Auto: every capability keeps a home in the 0.27.0 Auto', () => {
  it('Start an auto from the Auto agents entry, with the Limit of the workspace', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-start'] });

    fireEvent.click(await screen.findByRole('button', { name: 'Start an auto' }, WAIT));
    const start = await screen.findByRole('region', { name: 'Start an auto' }, WAIT);
    expect(within(start).getByRole('textbox', { name: 'Describe the work' })).toBeDefined();
    expect(screen.getByText(/^Limit \$/)).toBeDefined();
    expect(screen.queryByText(/Spend cap/)).toBeNull();
  });

  it('Experimental marking: the chip on the Auto agents entry', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-session-level'] });

    const buttons = await screen.findAllByRole('button', { name: /Auto agents/ }, WAIT);
    const entry = buttons.find((button) => button.closest('[data-slot="trail"]') === null);
    if (entry === undefined) {
      throw new Error('no Auto agents entry outside the trail');
    }
    expect(within(entry).getByText('Experimental')).toBeDefined();
  });

  it('Agents tree task, model and time: the task and the model in the row tooltip', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-working'] });

    const level = await autoLevel();
    const implementer = within(level).getByRole('treeitem', { name: /^Implementer, / });
    fireEvent.pointerEnter(implementer, { pointerType: 'mouse' });
    const card = (await screen.findByTestId('fact-card', undefined, WAIT)).textContent;
    expect(card).toContain('Post one credit per retry');
    expect(card).toContain('Sonnet 5.5');
  });

  it('Rail foot Spent, Reserved, Left: the foot says the left, the popover the rest', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-working'] });

    const foot = within(await autoLevel()).getByRole('region', { name: 'Limit' });
    fireEvent.click(within(foot).getByRole('button', { name: 'Limit $10.00 · $5.23 left' }));
    const popover = screen.getByRole('dialog', { name: 'Limit for this Auto run' });
    expect(within(popover).getByText('Spent')).toBeDefined();
    expect(within(popover).getByText('$0.27')).toBeDefined();
    expect(within(popover).getByText('Reserved')).toBeDefined();
    expect(within(popover).getByText('$4.50')).toBeDefined();
    expect(within(popover).getByText('Turns')).toBeDefined();
  });

  it('Delegation reason and model changed note, no Reserved up to: the child pane brief', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-child'] });

    expect(await screen.findByText(/^Why Auto chose Implementer:/, undefined, WAIT)).toBeDefined();
    expect(screen.queryByText(/Reserved up to/)).toBeNull();
  });

  it('Delegation result and Returned to Auto: the end of the child pane', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-child-done'] });

    expect(await screen.findByText('Returned to Auto', undefined, WAIT)).toBeDefined();
    expect(screen.getByText('keeps the balance after two attempts')).toBeDefined();
  });

  it('Auto phase words and Change approach: the tail of the Auto chat', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-working'] });

    const tail = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-auto-tail]');
      expect(found).not.toBeNull();
      return found;
    }, WAIT);
    if (tail === null) {
      throw new Error('no tail');
    }
    expect(tail.textContent).toContain('Waiting for Implementer and Tester');
    expect(within(tail).getByRole('button', { name: 'Change approach' })).toBeDefined();
    expect(within(tail).getByRole('button', { name: 'Stop Auto and its agents' })).toBeDefined();
  });

  it('Composer placeholder by state: Message Auto while Auto waits', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-working'] });

    expect(await screen.findByPlaceholderText('Message Auto', undefined, WAIT)).toBeDefined();
  });

  it('Revision line: the same producer line says revising v2', async () => {
    mount({ Scene: U24_AUTO_CHAT_SCENES['auto-chat-revising'] });

    expect(await screen.findByText('revising v2', undefined, WAIT)).toBeDefined();
  });

  it('Confirm a revise: Confirm and Cancel under its line', async () => {
    mount({ Scene: U24_AUTO_CHAT_SCENES['auto-chat-confirm'] });

    expect(
      await screen.findByText('Revise Retry-safe credit retries to v2?', undefined, WAIT),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDefined();
  });

  it('Auto plan approval: the ask with Approve plan and Ask for changes', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-plan'] });

    expect(await screen.findByText('Plan v1 needs your approval', undefined, WAIT)).toBeDefined();
    expect(screen.getByText('Approve plan').closest('button')).not.toBeNull();
    expect(screen.getByText('Ask for changes').closest('button')).not.toBeNull();
  });

  it('Child page notice with Open Auto, after Open full', async () => {
    mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-child'] });

    const openFull = (await screen.findByText('Open full', undefined, WAIT)).closest('button');
    if (openFull === null) {
      throw new Error('no Open full');
    }
    fireEvent.click(openFull);

    expect(await screen.findByText('Open Auto', undefined, WAIT)).toBeDefined();
    expect(screen.getByText('Started by Auto. Auto sees what you tell it.')).toBeDefined();
  });
});
