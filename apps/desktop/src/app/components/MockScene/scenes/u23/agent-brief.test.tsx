// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { U23_AGENT_BRIEF_SCENES } from './agent-brief';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const renderScene = (id: keyof typeof U23_AGENT_BRIEF_SCENES) => {
  const Scene = U23_AGENT_BRIEF_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const WAIT = { timeout: 4000 };

describe('the u23 agent brief scenes', () => {
  it('registers the door scenes', () => {
    expect(Object.keys(U23_AGENT_BRIEF_SCENES).sort()).toEqual([
      'agent-brief-door',
      'agent-brief-door-transcript',
    ]);
  });

  it('opens a running agent on the Brief with its subagents, no Now block and no 0 turns', async () => {
    renderScene('agent-brief-door');

    const tab = await screen.findByRole('tab', { name: 'Brief' }, WAIT);
    expect(tab.getAttribute('aria-selected')).toBe('true');
    await screen.findByText('Subagents', undefined, WAIT);
    await screen.findByText('1 of 2 done', undefined, WAIT);
    expect(screen.queryByText('Now')).toBeNull();
    expect(screen.queryByText('ready')).toBeNull();
    expect(screen.queryByText(/\b0 turns\b/u)).toBeNull();
    expect(within(screen.getByTestId('subagent-tree')).queryByText('Implementer')).toBeNull();
  });

  it('opens on the Transcript when the door asked for it', async () => {
    renderScene('agent-brief-door-transcript');

    const tab = await screen.findByRole('tab', { name: 'Transcript' }, WAIT);
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByText('Subagents')).toBeNull();
  });
});
