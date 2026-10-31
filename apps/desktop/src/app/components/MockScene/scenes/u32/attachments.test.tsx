// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U32_ATTACHMENTS_SCENES } from './attachments';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
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
  localStorage.clear();
});

describe('the attachments scenes', () => {
  it('registers both scenes for the capture', () => {
    expect(Object.keys(U32_ATTACHMENTS_SCENES)).toEqual([
      'u32-attachments',
      'u32-attachments-viewer',
    ]);
    expect(MOCK_SCENES['u32-attachments']).toBe(U32_ATTACHMENTS_SCENES['u32-attachments']);
    expect(MOCK_SCENES['u32-attachments-viewer']).toBe(
      U32_ATTACHMENTS_SCENES['u32-attachments-viewer'],
    );
  });

  it('frames the capture on one 680px element with the five thumbnails and the file chip', async () => {
    const Scene = U32_ATTACHMENTS_SCENES['u32-attachments'];
    const { container } = render(<Scene />);

    await screen.findByRole('button', { name: 'Preview checkout-502.png' }, WAIT);
    const frames = container.querySelectorAll<HTMLElement>('[data-shot]');
    expect(frames).toHaveLength(1);
    expect(frames[0]?.style.width).toBe('680px');
    expect(frames[0]?.children).toHaveLength(1);
    const frame = within(frames[0] ?? container);
    expect(frame.getAllByRole('button', { name: /^Preview .*\.png$/ })).toHaveLength(5);
    frame.getByText('ledger-notes.txt');
    await waitFor(() => expect(frames[0]?.querySelectorAll('img')).toHaveLength(5), WAIT);
  });

  it('opens the viewer on the second image with the other four in the rail', async () => {
    const Scene = U32_ATTACHMENTS_SCENES['u32-attachments-viewer'];
    render(<Scene />);

    const heading = await screen.findByRole('heading', { level: 2, hidden: true }, WAIT);
    expect(heading.textContent).toBe('ledger-diff.png');
    const rail = screen.getByRole('list', { name: 'Images in this message', hidden: true });
    expect(within(rail).getAllByRole('button', { hidden: true })).toHaveLength(5);
    const user = userEvent.setup();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('heading', { level: 2, hidden: true }).textContent).toBe(
      'retry-trace.png',
    );
  });
});
