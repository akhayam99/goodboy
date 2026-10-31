// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('shows no picture while it loads and the picture once it has loaded', async () => {
    let resolve: (value: string) => void = () => undefined;
    invoke.mockReturnValue(
      new Promise<string>((done) => {
        resolve = done;
      }),
    );
    render(
      <ReleaseImage version="0.29.8" image="question-card" hasBefore={false} alt="Wide card" />,
    );

    expect(screen.queryByRole('img')).toBeNull();
    resolve('data:image/webp;base64,AAA=');
    expect(await screen.findByRole('img', { name: 'Wide card' })).toBeTruthy();
  });

  it('renders only the after picture when there is no before picture', async () => {
    invoke.mockResolvedValue('data:image/webp;base64,AAA=');
    const { container } = render(
      <ReleaseImage version="0.29.8" image="question-card" hasBefore={false} alt="Wide card" />,
    );

    await screen.findByRole('img', { name: 'Wide card' });
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('keeps both pictures in the frame and exposes only the chosen one', async () => {
    invoke.mockImplementation((_command: string, args: { file: string }) =>
      Promise.resolve(
        `data:image/webp;base64,${args.file.includes('-before-') ? 'BEFORE' : 'AFTER'}=`,
      ),
    );
    const { container } = render(
      <ReleaseImage version="0.29.8" image="question-card" hasBefore={true} alt="Wide card" />,
    );

    const after = await screen.findByRole('img', { name: 'Wide card' });
    expect(after.getAttribute('src')).toContain('AFTER');
    expect(container.querySelectorAll('img')).toHaveLength(2);

    fireEvent.click(screen.getByRole('tab', { name: 'Before' }));
    const before = await screen.findByRole('img', { name: 'Wide card' });
    expect(before.getAttribute('src')).toContain('BEFORE');
    expect(container.querySelectorAll('img')).toHaveLength(2);
  });

  it('opens the viewer on the picture that is shown', async () => {
    invoke.mockResolvedValue('data:image/webp;base64,AAA=');
    render(
      <ReleaseImage version="0.29.8" image="question-card" hasBefore={true} alt="Wide card" />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Wide card' }));
    expect(await screen.findByRole('dialog', { hidden: true })).toBeTruthy();
  });
});
