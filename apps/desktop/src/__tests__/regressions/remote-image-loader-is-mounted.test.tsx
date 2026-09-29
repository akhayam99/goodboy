// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { Markdown } from '@goodboy/ui';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));
vi.mock('../../App', () => ({
  App: () => <Markdown text="![board](https://example.com/board.png)" />,
}));
vi.mock('../../app/components/MockScene', () => ({ MockScene: () => null }));
vi.mock('../../features/bug-report/crashReport', () => ({
  crashKind: () => 'error',
  crashPart: () => '',
  describeCrash: () => '',
  installCrashCapture: vi.fn(),
}));

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue('data:image/png;base64,iVBORw0KGgo=');
  document.body.innerHTML = '<div id="root"></div>';
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('remote image loader', () => {
  it('lets a markdown body in the app load one image through the backend', async () => {
    await import('../../main');

    fireEvent.click(await screen.findByRole('button', { name: 'Load' }));

    await vi.waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('fetch_remote_image', {
        url: 'https://example.com/board.png',
      }),
    );
  });
});
