// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { liveTextRegistry } from '../../../../../features/chat/reveal/liveTextRegistry';
import { revealPacer } from '../../../../../features/chat/reveal/revealPacer';
import { MOCK_SCENES } from '../..';
import { U27_REVEAL_SCENES } from './reveal';

const HEADING = 'Why ledger-core rejects PR #309';
const LAST_LINE = 'Want me to open that follow-up on payments-api?';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers();
  liveTextRegistry.clear();
  revealPacer.reset();
});

afterEach(() => {
  cleanup();
  revealPacer.reset();
  vi.useRealTimers();
});

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U27_REVEAL_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const settle = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe('the u27 reveal scenes', () => {
  it('registers a light and a dark shot of each state', () => {
    expect(Object.keys(U27_REVEAL_SCENES)).toEqual([
      'u27-reveal-mid-light',
      'u27-reveal-mid-dark',
      'u27-reveal-long-light',
      'u27-reveal-long-dark',
      'u27-reveal-still-light',
      'u27-reveal-still-dark',
      'u27-reveal-table-light',
      'u27-reveal-table-dark',
    ]);
    for (const [id, Scene] of Object.entries(U27_REVEAL_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('writes the answer in live once the turn ends, then shows all of it', () => {
    const { container } = mount({ id: 'u27-reveal-long-light' });
    expect(container.textContent).not.toContain(HEADING);

    settle(400);
    expect(container.querySelector('[data-reveal-answer]')).not.toBeNull();
    expect(container.textContent).not.toContain(LAST_LINE);

    settle(4000);
    expect(container.querySelector('[data-reveal-answer]')).toBeNull();
    expect(container.textContent).toContain(HEADING);
    expect(container.textContent).toContain(LAST_LINE);
  });

  it('shows an answer that was not live whole as soon as it lands', () => {
    const { container } = mount({ id: 'u27-reveal-still-dark' });

    settle(400);

    expect(container.querySelector('[data-reveal-answer]')).toBeNull();
    expect(container.textContent).toContain(HEADING);
    expect(container.textContent).toContain(LAST_LINE);
  });

  it('keeps the table out of the view until its end is in, then shows every row at once', () => {
    const { container } = mount({ id: 'u27-reveal-table-light' });

    settle(300);
    expect(container.querySelector('table')).toBeNull();

    for (let frame = 0; frame < 120 && container.querySelector('table') === null; frame += 1) {
      settle(16);
    }
    const table = container.querySelector('table');
    expect(table?.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(table?.querySelectorAll('[data-fresh]').length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('Only the last two steps');

    settle(4000);
    expect(container.querySelector('[data-fresh]')).toBeNull();
    expect(container.textContent).toContain('Only the last two steps need a quiet window.');
  });

  it('holds the mid shot before the answer lands', () => {
    const { container } = mount({ id: 'u27-reveal-mid-dark' });

    settle(1000);

    expect(container.querySelector('[data-reveal-answer]')).toBeNull();
    expect(container.textContent).not.toContain(HEADING);
  });
});
