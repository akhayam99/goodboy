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

  it('shows a wide crop and a tall crop whole, never cropped to a fixed frame', async () => {
    invoke.mockResolvedValue('data:image/webp;base64,AAA=');
    const { container } = render(
      <>
        <ReleaseImage version="0.29.8" image="question-card" hasBefore={true} alt="Wide card" />
        <ReleaseImage version="0.29.8" image="rail-groups" hasBefore={true} alt="Tall rail" />
      </>,
    );

    const wide = await screen.findByRole('img', { name: 'Wide card' });
    const tall = await screen.findByRole('img', { name: 'Tall rail' });
    expect(wide.getAttribute('data-release-image-fit')).toBe('contain');
    expect(tall.getAttribute('data-release-image-fit')).toBe('contain');
    const frames = [...container.querySelectorAll('[data-release-image-frame]')].map((frame) =>
      frame.getAttribute('data-release-image-frame'),
    );
    expect(frames).toEqual(['image', 'image']);
  });

  it('holds the 16:10 placeholder only while the picture loads', async () => {
    invoke.mockReturnValue(new Promise(() => undefined));
    const { container } = render(
      <ReleaseImage version="0.29.8" image="question-card" hasBefore={false} alt="Wide card" />,
    );

    await waitFor(() =>
      expect(
        container
          .querySelector('[data-release-image-frame]')
          ?.getAttribute('data-release-image-frame'),
      ).toBe('placeholder'),
    );
    expect(screen.queryByRole('img')).toBeNull();
  });
});
