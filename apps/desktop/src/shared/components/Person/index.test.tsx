// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { RemoteImageLoaderProvider } from '@goodboy/ui';
import { Person } from '.';

afterEach(cleanup);

const PICTURE = 'data:image/png;base64,iVBORw0KGgo=';

describe('Person', () => {
  it('shows the login beside a monogram when no picture is known', () => {
    const { container } = render(<Person login="nadia-p" avatarUrl={null} />);

    expect(screen.getAllByText('nadia-p')).toHaveLength(1);
    expect(container.querySelector('[data-person]')?.textContent).toBe('Nnadia-p');
  });

  it('reads Someone once when the login is missing', () => {
    const { container } = render(<Person login={null} avatarUrl="https://avatars.test/a.png" />);

    expect(screen.getAllByText('Someone')).toHaveLength(1);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-person]')?.textContent).toBe('?Someone');
  });

  it('reads Someone for an empty login', () => {
    render(<Person login="" avatarUrl={null} />);

    expect(screen.getAllByText('Someone')).toHaveLength(1);
  });

  it('draws a bot as a square tile with no picture', () => {
    const { container } = render(
      <Person login="cascadia-lint[bot]" avatarUrl="https://a.test/b.png" isBot />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-person]')?.getAttribute('data-person-kind')).toBe('bot');
    expect(container.querySelector('[data-person]')?.textContent).toBe('cascadia-lint[bot]');
  });

  it('draws a person as a picture slot, never a bot tile', () => {
    const { container } = render(<Person login="nadia-p" avatarUrl={null} />);

    expect(container.querySelector('[data-person]')?.getAttribute('data-person-kind')).toBe(
      'human',
    );
  });

  it('keeps the size it was given for the meta line, the rail and the timeline', () => {
    const { container, rerender } = render(<Person login="nadia-p" avatarUrl={null} size="xs" />);
    const sizeOf = () => container.querySelector('[data-person]')?.getAttribute('data-person-size');

    expect(sizeOf()).toBe('xs');
    rerender(<Person login="nadia-p" avatarUrl={null} size="sm" />);
    expect(sizeOf()).toBe('sm');
    rerender(<Person login="nadia-p" avatarUrl={null} size="md" />);
    expect(sizeOf()).toBe('md');
  });

  it('loads the picture through the app loader and keeps the login as the only name', async () => {
    const { container } = render(
      <RemoteImageLoaderProvider load={async () => PICTURE} loadAvatar={async () => PICTURE}>
        <Person login="nadia-p" avatarUrl="https://avatars.test/nadia.png" />
      </RemoteImageLoaderProvider>,
    );

    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe(PICTURE));
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(screen.getAllByText('nadia-p')).toHaveLength(1);
  });
});
