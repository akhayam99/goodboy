// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RemoteImage } from '../components/RemoteImage';

afterEach(cleanup);

const PNG_DATA_URI = 'data:image/png;base64,iVBORw0KGgo=';
const REMOTE_URL = 'https://user-images.githubusercontent.com/1/screenshot.png';

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('RemoteImage', () => {
  it('names the host and the alt text without fetching anything', () => {
    const load = vi.fn();
    const { container } = render(
      <RemoteImage url={REMOTE_URL} alt="the failing board" load={load} />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(load).not.toHaveBeenCalled();
    expect(container.textContent).toContain('user-images.githubusercontent.com');
    expect(container.textContent).toContain('the failing board');
    expect(container.textContent).not.toContain('/screenshot.png');
  });

  it('loads exactly that one image in place when the user clicks', async () => {
    const load = vi.fn().mockResolvedValue(PNG_DATA_URI);
    const { container } = render(<RemoteImage url={REMOTE_URL} alt="board" load={load} />);

    fireEvent.click(screen.getByRole('button', { name: 'Load image' }));
    await flush();

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith({ url: REMOTE_URL });
    expect(container.querySelector('img')?.getAttribute('src')).toBe(PNG_DATA_URI);
  });

  it('returns the placeholder with a retry when the load fails', async () => {
    const load = vi.fn().mockRejectedValue(new Error('could not reach the host'));
    const { container } = render(<RemoteImage url={REMOTE_URL} alt="board" load={load} />);

    fireEvent.click(screen.getByRole('button', { name: 'Load image' }));
    await flush();

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('user-images.githubusercontent.com');
    const retry = screen.getByRole('button', { name: 'Try again' });

    fireEvent.click(retry);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('refuses a loader result that is not a data uri', async () => {
    const load = vi.fn().mockResolvedValue(REMOTE_URL);
    const { container } = render(<RemoteImage url={REMOTE_URL} alt="board" load={load} />);

    fireEvent.click(screen.getByRole('button', { name: 'Load image' }));
    await flush();

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('offers no action when no loader is wired', () => {
    const { container } = render(<RemoteImage url={REMOTE_URL} alt="board" />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(container.textContent).toContain('user-images.githubusercontent.com');
  });
});
