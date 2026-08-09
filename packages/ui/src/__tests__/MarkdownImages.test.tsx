// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Markdown } from '../components/Markdown';
import { RemoteImageLoaderProvider } from '../components/RemoteImage/RemoteImageLoaderProvider';

afterEach(cleanup);

const PNG_DATA_URI = 'data:image/png;base64,iVBORw0KGgo=';

describe('Markdown images', () => {
  it('emits no remote src for an http image and names its host instead', () => {
    const { container } = render(
      <Markdown text="![the failing board](https://evil.example.com/track/abc.png)" />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).not.toContain('evil.example.com/track/abc.png');
    expect(container.textContent).toContain('evil.example.com');
    expect(container.textContent).toContain('the failing board');
  });

  it('renders a data image directly, since it reaches no host', () => {
    const { container } = render(<Markdown text={`![chart](${PNG_DATA_URI})`} />);

    const image = container.querySelector('img');
    expect(image?.getAttribute('src')).toBe(PNG_DATA_URI);
    expect(image?.getAttribute('alt')).toBe('chart');
  });

  it('refuses a data image that carries markup, as the backend does', () => {
    const { container } = render(
      <Markdown text={'![shape](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)'} />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).not.toContain('svg');
    expect(container.textContent).toContain('shape');
  });

  it('leaves a relative image alone', () => {
    const { container } = render(<Markdown text="![diagram](./docs/diagram.png)" />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('diagram');
  });

  it('loads one image in place on click and never before it', async () => {
    const load = vi.fn().mockResolvedValue(PNG_DATA_URI);
    const { container } = render(
      <RemoteImageLoaderProvider load={load}>
        <Markdown text="![board](https://example.com/one.png)" />
      </RemoteImageLoaderProvider>,
    );

    expect(load).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Load image' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith({ url: 'https://example.com/one.png' });
    expect(container.querySelector('img')?.getAttribute('src')).toBe(PNG_DATA_URI);
  });

  it('keeps a body with two hosts at two separate decisions', () => {
    const load = vi.fn();
    render(
      <RemoteImageLoaderProvider load={load}>
        <Markdown
          text={'![a](https://one.example.com/a.png)\n\n![b](https://two.example.com/b.png)'}
        />
      </RemoteImageLoaderProvider>,
    );

    expect(screen.getAllByRole('button', { name: 'Load image' })).toHaveLength(2);
    expect(screen.getByText('one.example.com')).toBeTruthy();
    expect(screen.getByText('two.example.com')).toBeTruthy();
  });

  it('shows the alt text alone in the compact preview variant', () => {
    const { container } = render(
      <Markdown variant="preview" text="![the failing board](https://example.com/a.png)" />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('the failing board');
  });
});
