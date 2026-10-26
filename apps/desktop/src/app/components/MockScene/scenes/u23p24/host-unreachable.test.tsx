// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import { U23P24_HOST_UNREACHABLE_SCENES } from './host-unreachable';

const SCENE = 'u23p24-host-unreachable';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  applyDocumentTheme({ theme: 'dark' });
});

const mount = async (): Promise<Element> => {
  const Scene = U23P24_HOST_UNREACHABLE_SCENES[SCENE];
  if (Scene === undefined) {
    throw new Error('no scene');
  }
  const { container } = render(<Scene />);
  await screen.findByRole('status');
  return container;
};

describe('the host unreachable scene', () => {
  it('registers the scene for the capture', () => {
    expect(MOCK_SCENES[SCENE]).toBe(U23P24_HOST_UNREACHABLE_SCENES[SCENE]);
  });

  it('shows one line for GitLab with Retry and the backed off pace', async () => {
    await mount();

    expect(screen.getAllByRole('status')).toHaveLength(1);
    screen.getByText(/GitLab unreachable since/);
    screen.getByText('Checking again every 5 minutes.');
    screen.getByRole('button', { name: 'Retry' });
  });

  it('has no accessibility violation', async () => {
    const container = await mount();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
