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

  it('shows the provider and no model in the header of a finished agent', async () => {
    renderScene('agent-finished-model');

    const row = await screen.findByTestId('agent-header-title-row');
    expect(within(row).getByTestId('agent-header-provider')).toBeDefined();
    expect(within(row).queryByText('Opus 5')).toBeNull();
    expect(screen.queryByTestId('agent-header-meta')).toBeNull();
  });

  it('names the next turn model on the composer chip, never a bare Model word', async () => {
    renderScene('agent-finished-model');

    const trigger = await screen.findByRole('button', { name: /^Model routing:/ });
    expect(trigger.textContent).toContain('Opus 5');
    expect(trigger.textContent).not.toMatch(/^Model/);
  });

  it('puts Stop as one word on the composer and the live chip of a running agent, never on the tail', async () => {
    renderScene('agent-running-stop');

    const stops = await screen.findAllByRole('button', { name: 'Stop' });
    expect(stops.every((stop) => stop.textContent === 'Stop' || stop.textContent === '')).toBe(
      true,
    );
    expect(stops.some((stop) => stop.closest('[data-conversation-tail]') !== null)).toBe(false);
    const row = screen.getByTestId('agent-header-title-row');
    expect(within(row).getAllByRole('button', { name: 'Stop' })).toHaveLength(1);
    expect(within(row).queryByText('Next turn:')).toBeNull();
  });

  it('shows artifact rows with no kind column and at most one action, Delete only on right click', async () => {
    renderScene('artifacts-rows');

    const list = await screen.findByTestId('artifact-list');
    expect(within(list).queryAllByTestId('artifact-row-kind')).toEqual([]);
    expect(within(list).queryAllByRole('button', { name: /^More for / })).toEqual([]);
    expect(
      within(list)
        .queryAllByRole('button', { name: /^Delete / })
        .filter((button) => button.closest('[data-testid="artifact-group-deleted"]') === null),
    ).toEqual([]);
    const frames = within(list).getAllByTestId('artifact-row-frame');
    for (const frame of frames) {
      const visible = within(frame)
        .queryAllByRole('button', { hidden: true })
        .filter((button) => button.closest('[data-row-secondary=""]') === null)
        .filter((button) => button.getAttribute('aria-expanded') === null)
        .filter((button) => button.getAttribute('data-artifact-row') === null)
        .filter((button) => !(button.getAttribute('aria-label') ?? '').startsWith('More for'));
      expect(visible.length).toBeLessThanOrEqual(1);
    }
    const groups = list.querySelectorAll('section[data-testid^="artifact-group-"]');
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(group.querySelector('h2')).not.toBeNull();
      if (group.getAttribute('data-testid') !== 'artifact-group-deleted') {
        expect(group.querySelector(':scope > div > button[aria-expanded]')).toBeNull();
      }
    }
    expect(within(list).queryByRole('heading', { name: /^Ran\b/ })).toBeNull();
  });

  it('keeps Run and Stop visible on one right edge and no overflow on the rows', async () => {
    renderScene('scripts-rows');

    const stops = await screen.findAllByRole('button', { name: /^Stop / });
    expect(stops.length).toBeGreaterThan(0);
    for (const stop of stops) {
      expect(stop.closest('[data-row-secondary]')).toBeNull();
    }
    const run = screen.getAllByRole('button', { name: /^Run / })[0]!;
    expect(run.closest('[data-row-secondary]')).toBeNull();
    expect(screen.queryAllByRole('button', { name: /^More for / })).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /scripts again$/ })).toHaveLength(1);
  });

  it('suggests scripts for a project with nothing pinned and opens the rest from Pin a script', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    renderScene('scripts-empty-group');
    await settle();

    expect(screen.queryByRole('region', { name: /^Suggested of /u })).toBeNull();
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
    expect(
      await screen.findByRole('region', { name: 'Scripts of northwind-storefront' }),
    ).toBeDefined();
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
