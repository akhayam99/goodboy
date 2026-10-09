// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../../index';
import { U23_LISTS_SCENES } from './lists';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const SCENE_IDS = [
  'agent-finished-model',
  'agent-running-stop',
  'artifacts-rows',
  'scripts-rows',
  'scripts-empty-group',
] as const;

const AGENT_PAGE_SCENES = [
  'agent-brief',
  'agent-brief-question',
  'planner-transcript',
  'planner-transcript-revising',
  'scribe-proposal-creating',
  'scribe-proposal-failed',
  'scribe-proposal-transcript',
  'agent-finished-model',
  'agent-running-stop',
] as const;

const renderScene = (id: string) => {
  const Scene = (MOCK_SCENES as Record<string, (typeof U23_LISTS_SCENES)[string]>)[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
};

describe('the u23 list scenes', () => {
  it('registers exactly the scenes the plan names', () => {
    expect(Object.keys(U23_LISTS_SCENES).sort()).toEqual([...SCENE_IDS].sort());
  });

  it('names the model of the last turn in the header of a finished agent', async () => {
    renderScene('agent-finished-model');

    const meta = await screen.findByTestId('agent-header-meta');
    expect(within(meta).getByText('Opus 5')).toBeDefined();
    expect(within(meta).queryByText('Model unknown')).toBeNull();
    expect(within(meta).queryByText('Next turn:')).toBeNull();
  });

  it('keeps the composer model chip quiet while it matches the header', async () => {
    renderScene('agent-finished-model');

    const trigger = await screen.findByRole('button', { name: /^Model routing:/ });
    expect(trigger.textContent).toContain('Model');
    expect(trigger.textContent).not.toContain('Opus 5');
  });

  it('labels Stop with a word and the model as the next turn on a running agent', async () => {
    renderScene('agent-running-stop');

    const stop = await screen.findByRole('button', { name: 'Stop' });
    expect(stop.textContent).toBe('Stop');
    const meta = screen.getByTestId('agent-header-meta');
    expect(within(meta).getByText('Next turn:')).toBeDefined();
    expect(within(meta).getByText('Sonnet 5')).toBeDefined();
  });

  it('shows artifact rows with a kind column and one action, Delete only in the overflow', async () => {
    renderScene('artifacts-rows');

    const list = await screen.findByTestId('artifact-list');
    const kinds = within(list)
      .getAllByTestId('artifact-row-kind')
      .map((cell) => cell.textContent);
    expect(kinds).toEqual(expect.arrayContaining(['Plan', 'Report', 'Wireframe']));
    expect(within(list).queryAllByRole('button', { name: /^Delete / })).toEqual([]);
    const frames = within(list).getAllByTestId('artifact-row-frame');
    for (const frame of frames) {
      const visible = within(frame)
        .queryAllByRole('button', { hidden: true })
        .filter((button) => button.closest('[data-reveal="hover"]') === null)
        .filter((button) => button.getAttribute('aria-expanded') === null)
        .filter((button) => button.getAttribute('data-artifact-row') === null)
        .filter((button) => !(button.getAttribute('aria-label') ?? '').startsWith('More for'));
      expect(visible.length).toBeLessThanOrEqual(1);
    }
  });

  it('puts every script row action on one right edge and keeps Stop for the running one', async () => {
    renderScene('scripts-rows');

    const stops = await screen.findAllByRole('button', { name: /^Stop / });
    expect(stops.length).toBeGreaterThan(0);
    for (const stop of stops) {
      expect(stop.closest('[data-reveal]')).toBeNull();
    }
    const run = screen.getAllByRole('button', { name: /^Run / })[0]!;
    expect(run.closest('[data-reveal="hover"]')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /scripts again$/ })).toHaveLength(1);
  });

  it('opens the scripts of an empty project inline from Pin a script', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    renderScene('scripts-empty-group');
    await settle();

    expect(screen.getByText('No scripts in northwind-storefront')).toBeDefined();
    expect(screen.queryByText(/Settings/)).toBeNull();
    const picker = screen.getByRole('region', { name: 'Scripts of northwind-storefront' });
    expect(within(picker).getAllByRole('button', { name: /^Pin / }).length).toBeGreaterThan(0);
  });

  it('keeps a quiet empty state until the user opens the list', async () => {
    renderScene('scripts-empty-group');

    const open = await screen.findByRole('button', {
      name: 'Pin a script of northwind-storefront',
    });
    expect(open).toBeDefined();
    fireEvent.click(open);
    expect(open.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('one h1 on every page the plan names', () => {
  it.each(AGENT_PAGE_SCENES)('agent page %s has exactly one h1', async (id) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    renderScene(id);
    await settle();

    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="agent-header-title-row"]')).toHaveLength(1);
  });

  it('puts the report document title in an h2 beside the single h1', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    renderScene('artifact-report');
    await settle();

    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(document.querySelector('h2.print-title')).not.toBeNull();
  });
});
