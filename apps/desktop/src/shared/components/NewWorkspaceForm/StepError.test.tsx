// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(async () => null) }));
vi.mock('@tauri-apps/api/path', () => ({ homeDir: vi.fn(async () => '/mock') }));

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
} from '../../../store/storyHarness';
import { NewWorkspaceForm } from './index';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ validate_git_repo: { isRepo: false, errorKind: 'not_found' } });
});

afterEach(cleanup);

describe('an error handed to the new workspace form', () => {
  it('is drawn in the action row, beside the buttons it blocks', () => {
    render(
      <NewWorkspaceForm mode="first-run" error="The folder moved" onCancel={() => undefined} />,
    );

    const actions = document.querySelector<HTMLElement>('[data-slot="form-actions"]');
    expect(actions).not.toBeNull();
    within(actions ?? document.body).getByText('The folder moved');
    expect(screen.getAllByText('The folder moved')).toHaveLength(1);
  });

  it('draws nothing when there is none', () => {
    render(<NewWorkspaceForm mode="first-run" onCancel={() => undefined} />);

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
