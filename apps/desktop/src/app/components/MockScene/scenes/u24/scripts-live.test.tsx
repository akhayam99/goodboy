// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U24_SCRIPTS_LIVE_SCENES } from './scripts-live';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

const renderScene = ({ name }: { readonly name: keyof typeof U24_SCRIPTS_LIVE_SCENES }) => {
  const Scene = U24_SCRIPTS_LIVE_SCENES[name];
  return render(<Scene />);
};

describe('the u24 scripts-live scenes', () => {
  it('draws services and tasks at rest with results and the exit by signal', async () => {
    renderScene({ name: 'scripts-live-idle' });

    const services = await screen.findByRole('region', { name: /^Services of /u });
    expect(within(services).getByText(':5005')).toBeDefined();
    expect(within(services).getByText('Exit 137')).toBeDefined();
    expect(within(services).getByText('Killed')).toBeDefined();
    const tasks = screen.getByRole('region', { name: /^Tasks of /u });
    expect(within(tasks).getByText('12s · 3m ago')).toBeDefined();
    expect(within(tasks).getByText(/^Exit 1 · /)).toBeDefined();
    expect(within(tasks).getByText(/error TS2322/)).toBeDefined();
    expect(screen.queryByRole('region', { name: /^Suggested of /u })).toBeNull();
  });

  it('draws a running service with its last line, port link and stop and restart', async () => {
    renderScene({ name: 'scripts-live-running' });

    const services = await screen.findByRole('region', { name: /^Services of /u });
    expect(within(services).getByText(/^vite v6/)).toBeDefined();
    expect(
      await within(services).findByRole('button', { name: 'Open localhost:5005' }),
    ).toBeDefined();
    expect(within(services).getByRole('button', { name: 'Stop dev' })).toBeDefined();
    expect(within(services).getByRole('button', { name: 'Restart dev' })).toBeDefined();
    expect(await within(services).findByText('210 MB')).toBeDefined();
  });

  it('warns that another worktree holds the expected port and keeps Run', async () => {
    renderScene({ name: 'scripts-live-portbusy' });

    const services = await screen.findByRole('region', { name: /^Services of /u });
    expect(await within(services).findByText(':5005 in use')).toBeDefined();
    expect(within(services).getByRole('button', { name: 'Run dev' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('draws the dimmed Suggested band with a Pin on each row', async () => {
    renderScene({ name: 'scripts-live-suggested' });

    const suggested = await screen.findByRole('region', { name: /^Suggested of /u });
    expect(within(suggested).getByText('Pin the ones you run here.')).toBeDefined();
    expect(
      within(suggested).getAllByRole('button', { name: /^Pin / }).length,
    ).toBeGreaterThanOrEqual(5);
    expect(screen.queryByRole('region', { name: /^Services of /u })).toBeNull();
  });
});
