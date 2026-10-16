// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { MonitoringSignal } from './MonitoringSignal';

const WORKSPACE = aWorkspace({ name: 'Harborline' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ workspaces: [WORKSPACE], currentWorkspaceId: WORKSPACE.id });
});

afterEach(cleanup);

describe('the monitoring signal in the top bar', () => {
  it('is a quiet icon named Monitoring before the first scan', () => {
    useAppStore.setState({ monitorPinned: [{ port: 9000, description: 'Mock API' }] });
    render(<MonitoringSignal />);

    const signal = screen.getByRole('button', { name: 'Monitoring' });
    expect(signal.getAttribute('data-monitoring-signal')).toBe('quiet');
    expect(signal.textContent).toBe('');
  });

  it('says Pinned port down with a warning dot when a pinned port is free', () => {
    useAppStore.setState({
      monitorSnapshot: { listeners: [], processes: [], takenAt: 1, isPlatformSupported: true },
      monitorPinned: [{ port: 9000, description: 'Mock API' }],
    });
    render(<MonitoringSignal />);

    const signal = screen.getByRole('button', { name: 'Monitoring, a pinned port is down' });
    expect(signal.getAttribute('data-monitoring-signal')).toBe('warning');
    expect(signal.textContent).toBe('Pinned port down');
  });

  it('opens the Monitoring studio and reads pressed while it is open', () => {
    render(<MonitoringSignal />);

    fireEvent.click(screen.getByRole('button', { name: 'Monitoring' }));

    expect(useAppStore.getState().appStudio?.kind).toBe('monitoring');
    expect(screen.getByRole('button', { name: 'Monitoring' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});
