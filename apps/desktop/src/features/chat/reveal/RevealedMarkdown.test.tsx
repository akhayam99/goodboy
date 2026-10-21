// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { STORE_IMPORT_TIMEOUT_MS, importStore } from '../../../store/storyHarness';
import { agentLiveKey } from './agentLiveKey';
import { liveTextRegistry } from './liveTextRegistry';
import { revealPacer } from './revealPacer';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());

import { RevealedMarkdown } from './RevealedMarkdown';

const LIVE_KEY = agentLiveKey({ agentId: 'agent-debugger' });
const FINDING = Array.from(
  { length: 30 },
  (_, index) => `Acme check ${index} fails because payments-api drops the header.`,
).join(' ');

const shown = ({ container }: { readonly container: HTMLElement }): string =>
  container.querySelector('p')?.textContent ?? '';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(() => {
  vi.useFakeTimers();
  liveTextRegistry.clear();
  revealPacer.reset();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  revealPacer.reset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('RevealedMarkdown', () => {
  it('writes in a text that lands while its agent is live', () => {
    liveTextRegistry.mark({ runId: LIVE_KEY });
    const { container } = render(
      <RevealedMarkdown liveKey={LIVE_KEY} itemKey="finding" text={FINDING} />,
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(shown({ container }).length).toBeGreaterThan(0);
    expect(shown({ container }).length).toBeLessThan(FINDING.length);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(shown({ container })).toBe(FINDING);
    expect(container.querySelector('[aria-busy]')).toBeNull();
  });

  it('shows a loaded text whole at once', () => {
    const { container } = render(
      <RevealedMarkdown liveKey={LIVE_KEY} itemKey="finding" text={FINDING} />,
    );

    expect(shown({ container })).toBe(FINDING);
    expect(container.querySelector('[aria-busy]')).toBeNull();
  });
});
