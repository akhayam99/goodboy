// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  WORKSPACE_ID,
  seedBoardScene,
} from '../../../../app/components/MockScene/scenes/BoardScene';
import type { IsoDateTime } from '@goodboy/types';
import { brandedId } from '../../../history/testing/brandedId';
import { KickoffProjects } from './KickoffProjects';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedBoardScene();
  useAppStore.setState((state) => ({
    projects: state.projects.map((project) =>
      project.name === 'ledger-core'
        ? {
            ...project,
            lastAccessedAt: brandedId<IsoDateTime>({
              value: new Date(Date.now() - 60_000).toISOString(),
            }),
          }
        : project,
    ),
  }));
});

afterEach(cleanup);

const openPicker = () => {
  render(<KickoffProjects workspaceId={WORKSPACE_ID} />);
  fireEvent.click(screen.getByRole('combobox', { name: 'Project' }));
  return within(screen.getByRole('listbox', { name: 'Project' }));
};

describe('KickoffProjects', () => {
  it('reads Add project and Optional while no project is picked, with no extra line', () => {
    render(<KickoffProjects workspaceId={WORKSPACE_ID} />);

    expect(screen.getByRole('combobox', { name: 'Project' }).textContent).toContain('Add project');
    expect(screen.getByText('Optional')).toBeDefined();
    expect(screen.queryByText(/Goodboy adds one/)).toBeNull();
  });

  it('groups the recently used project under Suggested and the rest under All projects', () => {
    const list = openPicker();

    expect(list.getByText('Suggested')).toBeDefined();
    expect(list.getByText('All projects')).toBeDefined();
    expect(list.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'ledger-core',
      'notify-relay',
      'payments-api',
    ]);
  });

  it('keeps Add project once a project is picked', () => {
    const list = openPicker();

    fireEvent.click(list.getByRole('option', { name: 'payments-api' }));

    expect(screen.getByRole('combobox', { name: 'Project' }).textContent).toContain('Add project');
    expect(screen.getByRole('button', { name: 'Remove payments-api' })).toBeDefined();
  });
});
