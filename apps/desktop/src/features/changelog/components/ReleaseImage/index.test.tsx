// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReleaseImage } from './index';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

vi.mock('../../../../shared/lib/theme', () => ({
  useAppliedTheme: () => 'dark',
}));

beforeEach(() => {
  invoke.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('ReleaseImage', () => {
  it('renders nothing while every variant is absent', async () => {
    invoke.mockResolvedValue(null);
    render(
      <ReleaseImage version="0.10.0" image="scroll-fade" hasBefore={false} alt="Scroll fade" />,
    );

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('changelog_image', {
        version: '0.10.0',
        file: 'scroll-fade-after-dark.webp',
      }),
    );
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows the after picture with no selector for a New entry', async () => {
    invoke.mockResolvedValue('data:image/webp;base64,AAA=');
    render(
      <ReleaseImage version="0.10.0" image="scroll-fade" hasBefore={false} alt="Scroll fade" />,
    );

    expect(await screen.findByRole('img', { name: 'Scroll fade' })).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('offers a before/after switch for an Improved entry and fetches both', async () => {
    invoke.mockResolvedValue('data:image/webp;base64,AAA=');
    render(<ReleaseImage version="0.10.0" image="crumb-menu" hasBefore={true} alt="Crumb menu" />);

    await screen.findByRole('img', { name: 'Crumb menu' });
    expect(invoke).toHaveBeenCalledWith('changelog_image', {
      version: '0.10.0',
      file: 'crumb-menu-before-dark.webp',
    });
    expect(invoke).toHaveBeenCalledWith('changelog_image', {
      version: '0.10.0',
      file: 'crumb-menu-after-dark.webp',
    });
  });
});
