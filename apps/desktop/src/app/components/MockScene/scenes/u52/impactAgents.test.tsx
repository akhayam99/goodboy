// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U52_IMPACT_AGENTS_SCENES } from './impactAgents';

const ROUTING_WORDS = /Balanced|In order|most room|Send new steps to|Auto routing/;

beforeAll(async () => {
  installFakeResizeObserver();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});
afterEach(() => {
  cleanup();
});

type Params = { readonly name: string };

const show = async ({ name }: Params) => {
  const Scene = U52_IMPACT_AGENTS_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown impact agents scene');
  }
  render(<Scene />);
  const table = await screen.findByRole('table', { name: 'Agent turns by role' });
  await waitFor(() => expect(within(table).getAllByRole('row').length).toBeGreaterThan(1));
  return table;
};

describe('the u52 impact agents scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U52_IMPACT_AGENTS_SCENES)).toEqual([
      'u52-impact-agents-dark',
      'u52-impact-agents-light',
      'u52-impact-agents-open-dark',
      'u52-impact-agents-open-light',
    ]);
  });

  it('opens on the Agents tab with roles sorted by turns', async () => {
    const table = await show({ name: 'u52-impact-agents-dark' });

    const roles = within(table)
      .getAllByRole('row')
      .map((row) => row.dataset['role'])
      .filter((role) => role !== undefined);
    expect(roles).toEqual(['implementer', 'scout', 'reviewer', 'tester', 'planner', 'docs']);
    expect(screen.getByRole('tab', { name: 'Agents' }).getAttribute('aria-selected')).toBe('true');
    expect(document.body.textContent ?? '').not.toMatch(ROUTING_WORDS);
  });

  it('opens the Implementer row to its models', async () => {
    await show({ name: 'u52-impact-agents-open-light' });

    const models = await screen.findByRole('table', { name: 'Implementer models' });
    expect(within(models).getAllByRole('row')).toHaveLength(4);
  });
});
