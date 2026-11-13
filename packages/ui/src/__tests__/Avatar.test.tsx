// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { Avatar } from '../components/Avatar';
import { RemoteImageLoaderProvider } from '../components/RemoteImage/RemoteImageLoaderProvider';
import { personHueOf } from '../personHueOf';

afterEach(cleanup);

const PICTURE = 'data:image/png;base64,iVBORw0KGgo=';
const OTHER_PICTURE = 'data:image/png;base64,AAAA';

type AddressParams = {
  readonly url: string;
};

type Deferred = {
  readonly promise: Promise<string>;
  readonly resolve: (value: string) => void;
};

const defer = (): Deferred => {
  let resolve: (value: string) => void = () => undefined;
  const promise = new Promise<string>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const idle = async (): Promise<string> => PICTURE;

describe('Avatar', () => {
  it('shows the picture the loader answers with', async () => {
    const loadAvatar = vi.fn(idle);
    render(
      <RemoteImageLoaderProvider load={idle} loadAvatar={loadAvatar}>
        <Avatar url="https://avatars.example.com/ada.png" alt="Ada Lovelace" />
      </RemoteImageLoaderProvider>,
    );

    const avatar = await screen.findByRole('img', { name: 'Ada Lovelace' });

    expect(avatar.getAttribute('src')).toBe(PICTURE);
    expect(loadAvatar).toHaveBeenCalledWith({ url: 'https://avatars.example.com/ada.png' });
  });

  it('marks the picture decorative when alt is empty', async () => {
    render(
      <RemoteImageLoaderProvider load={idle} loadAvatar={idle}>
        <Avatar url="https://avatars.example.com/ada.png" alt="" initialsSource="Ada" />
      </RemoteImageLoaderProvider>,
    );

    await waitFor(() => expect(document.querySelector('img')).not.toBeNull());

    expect(screen.queryByRole('img')).toBeNull();
    expect(document.querySelector('img')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('never puts the remote address on an img without a loader', () => {
    render(<Avatar url="https://avatars.example.com/ada.png" alt="Ada Lovelace" />);

    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('A').textContent).toBe('A');
  });

  it('falls back to the initial when there is no url', () => {
    render(<Avatar url={null} alt="Bo" />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('B').textContent).toBe('B');
  });

  it('falls back to a question mark when the name is empty', () => {
    render(<Avatar url={null} alt="" />);

    expect(screen.getByText('?').textContent).toBe('?');
  });

  it('derives the fallback initial from initialsSource when the img is decorative', () => {
    render(<Avatar url={null} alt="" initialsSource="Ada Lovelace" />);

    expect(screen.getByText('A').textContent).toBe('A');
  });

  it('shows the monogram once and does not loop when the loader fails', async () => {
    const loadAvatar = vi.fn(() => Promise.reject(new Error('refused')));
    render(
      <RemoteImageLoaderProvider load={idle} loadAvatar={loadAvatar}>
        <Avatar url="https://avatars.example.com/ada.png" alt="Ada Lovelace" />
      </RemoteImageLoaderProvider>,
    );

    await waitFor(() => expect(loadAvatar).toHaveBeenCalledTimes(1));
    await Promise.resolve();

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('A').textContent).toBe('A');
    expect(loadAvatar).toHaveBeenCalledTimes(1);
  });

  it('shows the monogram when the loader answers with something that is not a picture', async () => {
    const loadAvatar = vi.fn(async () => 'https://avatars.example.com/ada.png');
    render(
      <RemoteImageLoaderProvider load={idle} loadAvatar={loadAvatar}>
        <Avatar url="https://avatars.example.com/ada.png" alt="Ada Lovelace" />
      </RemoteImageLoaderProvider>,
    );

    await waitFor(() => expect(loadAvatar).toHaveBeenCalledTimes(1));

    expect(document.querySelector('img')).toBeNull();
  });

  it('drops a late answer for an address that is no longer on screen', async () => {
    const first = defer();
    const loadAvatar = vi.fn(({ url }: AddressParams) =>
      url.endsWith('first.png') ? first.promise : Promise.resolve(OTHER_PICTURE),
    );
    const view = ({ url }: AddressParams) => (
      <RemoteImageLoaderProvider load={idle} loadAvatar={loadAvatar}>
        <Avatar url={url} alt="Ada Lovelace" />
      </RemoteImageLoaderProvider>
    );
    const { rerender } = render(view({ url: 'https://avatars.example.com/first.png' }));

    rerender(view({ url: 'https://avatars.example.com/second.png' }));
    const avatar = await screen.findByRole('img', { name: 'Ada Lovelace' });
    first.resolve(PICTURE);
    await Promise.resolve();

    expect(avatar.getAttribute('src')).toBe(OTHER_PICTURE);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' }).getAttribute('src')).toBe(
      OTHER_PICTURE,
    );
  });
});

describe('personHueOf', () => {
  it('gives one login the same hue every time', () => {
    expect(personHueOf({ login: 'mara-l' })).toBe(personHueOf({ login: 'mara-l' }));
  });

  it('ignores letter case', () => {
    expect(personHueOf({ login: 'Mara-L' })).toBe(personHueOf({ login: 'mara-l' }));
  });

  it('stays inside the hues that avoid the danger and warning tones', () => {
    for (const login of ['mara-l', 'kenji-w', 'priya-n', 'nadia-p', 'omar-t', '']) {
      const hue = personHueOf({ login });
      expect(hue).toBeGreaterThanOrEqual(120);
      expect(hue).toBeLessThanOrEqual(330);
    }
  });
});
