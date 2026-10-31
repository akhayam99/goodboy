// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { HINT_NODE_SEED } from './hintNodeSeed';
import { U32_HINT_NODE_SCENES } from './hint-node';

const WAIT = { timeout: 15_000 };

const Scene = U32_HINT_NODE_SCENES['u32-hint-node'];

const scrollIntoView = vi.fn();

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    if (command === 'attachment_read') {
      const relPath = HINT_NODE_SEED.imageRelPathOf({ payload: args });
      return Promise.resolve(relPath === null ? null : HINT_NODE_SEED.imageDataUriOf({ relPath }));
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const readRow = () => {
  const row = document.querySelector<HTMLElement>('[data-hint-chip="read"]');
  if (row === null) {
    throw new Error('The read hint row is missing.');
  }
  return within(row);
};

const queuedRow = () => {
  const row = document.querySelector<HTMLElement>('[data-hint-chip="queued"]');
  if (row === null) {
    throw new Error('The queued hint row is missing.');
  }
  return within(row);
};

describe('the hint node scene', () => {
  it('registers the scene and frames the capture on one 680px element', async () => {
    expect(MOCK_SCENES['u32-hint-node']).toBe(Scene);
    const { container } = render(<Scene />);
    await screen.findByText('Waits for the next decision', undefined, WAIT);
    const frames = container.querySelectorAll<HTMLElement>('[data-shot]');
    expect(frames).toHaveLength(1);
    expect(frames[0]?.style.width).toBe('680px');
    expect(frames[0]?.children).toHaveLength(1);
  });

  it('shows a queued hint as a dashed node with its text and a Remove control', async () => {
    render(<Scene />);
    await screen.findByText('Waits for the next decision', undefined, WAIT);
    const row = queuedRow();
    row.getByText('Also cover the refund webhook.');
    row.getByRole('button', { name: 'Remove' });
    expect(
      row.getByRole('img', { name: 'Hint', hidden: true }).getAttribute('data-node-state'),
    ).toBe('queued');
    expect(row.queryByRole('button', { name: /Read at step/ })).toBeNull();
  });

  it('shows a read hint on the line with its step link and moves focus to that step by click', async () => {
    const user = userEvent.setup();
    render(<Scene />);
    const link = await screen.findByRole('button', { name: 'Read at step 3' }, WAIT);
    const row = readRow();
    expect(
      row.getByRole('img', { name: 'Hint', hidden: true }).getAttribute('data-node-state'),
    ).toBe('marker');
    await user.click(link);
    const stepRow = screen.getByTestId(`run-tree-row-${HINT_NODE_SEED.thirdAgentId}`);
    expect(stepRow.contains(document.activeElement)).toBe(true);
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(stepRow);
  });

  it('keeps the track line through the read hint down to the next step', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(120);
    render(<Scene />);
    await screen.findByRole('button', { name: 'Read at step 3' }, WAIT);
    const rail = document.querySelector('[data-hint-chip="read"] [data-hint-rail]');
    const lines = rail?.querySelectorAll('[data-testid="timeline-rail-segment"]') ?? [];
    expect(lines).toHaveLength(1);
    expect(Number(lines[0]?.getAttribute('y1'))).toBeLessThanOrEqual(0);
    expect(Number(lines[0]?.getAttribute('y2'))).toBeGreaterThanOrEqual(120);
  });

  it('moves focus to that step from the keyboard', async () => {
    const user = userEvent.setup();
    render(<Scene />);
    const link = await screen.findByRole('button', { name: 'Read at step 3' }, WAIT);
    link.focus();
    await user.keyboard('{Enter}');
    const stepRow = screen.getByTestId(`run-tree-row-${HINT_NODE_SEED.thirdAgentId}`);
    expect(stepRow.contains(document.activeElement)).toBe(true);
    link.focus();
    await user.keyboard(' ');
    expect(stepRow.contains(document.activeElement)).toBe(true);
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(stepRow);
  });

  it('expands a long hint and collapses it again with the keyboard, and keeps focus on the control', async () => {
    const user = userEvent.setup();
    render(<Scene />);
    await screen.findByRole('button', { name: 'Read at step 3' }, WAIT);
    const row = readRow();
    const toggle = row.getByRole('button', { name: /^Show more of hint: / });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(row.queryByText(/Check the webhook timeout/)).toBeNull();
    toggle.focus();
    await user.keyboard('{Enter}');
    const open = row.getByRole('button', { name: /^Show less of hint: / });
    expect(open.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(open);
    row.getByText(/Check the webhook timeout/);
    await user.keyboard(' ');
    expect(
      row.getByRole('button', { name: /^Show more of hint: / }).getAttribute('aria-expanded'),
    ).toBe('false');
    expect(row.queryByText(/Check the webhook timeout/)).toBeNull();
  });

  it('keeps a short hint on one line with no expand control', async () => {
    render(<Scene />);
    await screen.findByText('Waits for the next decision', undefined, WAIT);
    expect(queuedRow().queryByRole('button', { name: /^Show more/ })).toBeNull();
  });

  it('shows the hint images as thumbnails and opens the viewer on the clicked one', async () => {
    const user = userEvent.setup();
    render(<Scene />);
    const second = await screen.findByRole('button', { name: 'Preview relay-log.png' }, WAIT);
    await waitFor(
      () =>
        expect(document.querySelector('[data-hint-images]')?.querySelectorAll('img')).toHaveLength(
          2,
        ),
      WAIT,
    );
    await user.click(second);
    const viewer = await screen.findByRole('dialog', { hidden: true }, WAIT);
    const heading = within(viewer).getByRole('heading', { level: 2, hidden: true });
    expect(heading.textContent).toBe('relay-log.png');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(second));
  });
});
