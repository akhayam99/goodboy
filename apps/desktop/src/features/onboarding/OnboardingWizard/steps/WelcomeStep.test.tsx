// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../store/storyHarness';
import { agentHandlers } from '../testing/agentHandlers';
import { WelcomeStep } from './WelcomeStep';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('WelcomeStep', () => {
  it('opens on the brand tile at hero size, where the boot splash dog sits', () => {
    stubStoryInvoke(agentHandlers({ signedIn: [] }));
    const { container } = render(<WelcomeStep isLocked={false} onStart={() => undefined} />);
    const tile = container.querySelector<HTMLElement>('[data-brand-tile]');
    expect(tile?.style.width).toBe('84px');
    expect(screen.getByRole('heading', { name: 'Welcome to Goodboy' })).toBeDefined();
  });

  it('starts finding agents on mount and names the ones it found', async () => {
    stubStoryInvoke(
      agentHandlers({
        signedIn: ['anthropic'],
        claudeVersion: '2.1.280',
        codexVersion: 'codex-cli 0.62.0',
      }),
    );
    render(<WelcomeStep isLocked={false} onStart={() => undefined} />);
    expect(screen.getByRole('status').textContent).toBe('Looking for agents on this Mac');

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Found Claude and Codex on this Mac'),
    );
  });

  it('says so when no agent is on this Mac', async () => {
    stubStoryInvoke(agentHandlers({ signedIn: [] }));
    render(<WelcomeStep isLocked={false} onStart={() => undefined} />);

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('No agents on this Mac yet'),
    );
  });

  it('starts setup from the one button', () => {
    stubStoryInvoke(agentHandlers({ signedIn: [] }));
    const onStart = vi.fn();
    render(<WelcomeStep isLocked={false} onStart={onStart} />);

    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    expect(onStart).toHaveBeenCalledOnce();
  });
});
