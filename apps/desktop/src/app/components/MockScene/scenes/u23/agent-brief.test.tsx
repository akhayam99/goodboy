// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { useAppStore } from '../../../../../store';
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

  it('says each subagent as one delegation line, with no tabs, no Now block and no 0 turns', async () => {
    renderScene('agent-brief-door');

    const lines = await screen.findByRole('list', { name: 'Delegations' }, WAIT);
    expect(within(lines).getAllByText('Delegated to')).toHaveLength(2);
    expect(screen.queryByRole('tab', { name: 'Brief' })).toBeNull();
    expect(screen.queryByText('Now')).toBeNull();
    expect(screen.queryByText(/\b0 turns\b/u)).toBeNull();
  });

  it('opens a subagent in the pane from See more, and the transcript door lands on the same page', async () => {
    renderScene('agent-brief-door-transcript');

    const more = await screen.findByRole(
      'button',
      { name: 'See more about Read the cap in the retry loop' },
      WAIT,
    );
    fireEvent.click(more);
    const drawer = useAppStore.getState().drawer;
    expect(drawer?.kind === 'transcript' ? drawer.payload.agentId : null).toBe(
      'mock-agent-doors-done',
    );
    expect(screen.queryByRole('tab', { name: 'Transcript' })).toBeNull();
  });
});
