// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Markdown } from '../components/Markdown';
import { parseInline } from '../components/Markdown/parseInline';
import { parseMarkdown } from '../components/Markdown/parseMarkdown';
import { RemoteImageLoaderProvider } from '../components/RemoteImage/RemoteImageLoaderProvider';

afterEach(cleanup);

const PNG_DATA_URI = 'data:image/png;base64,iVBORw0KGgo=';
const ATTACHMENT = 'https://github.com/user-attachments/assets/9f2c-acme';
const OTHER_HOST = 'https://cdn.acme.dev/shot.png';

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

const isAttachment = (url: string): boolean =>
  url.startsWith('https://github.com/user-attachments/');

describe('comment media', () => {
  it('shows an image in the preview variant that review comments use', async () => {
    const load = vi.fn().mockResolvedValue(PNG_DATA_URI);
    const { container } = render(
      <RemoteImageLoaderProvider load={load} shouldAutoLoad={isAttachment}>
        <Markdown text={`See ![board](${ATTACHMENT}.png)`} variant="preview" />
      </RemoteImageLoaderProvider>,
    );
    await flush();

    const image = container.querySelector('img');
    expect(image?.getAttribute('src')).toBe(PNG_DATA_URI);
  });

  it('keeps an address that is not the tool host click to load', () => {
    const load = vi.fn();
    render(
      <RemoteImageLoaderProvider load={load} shouldAutoLoad={isAttachment}>
        <Markdown text={`![shot](${OTHER_HOST})`} variant="preview" />
      </RemoteImageLoaderProvider>,
    );

    expect(load).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Load' })).not.toBeNull();
  });

  it('opens a loaded image on the host through the open handler and never a dialog', async () => {
    const load = vi.fn().mockResolvedValue(PNG_DATA_URI);
    const onOpen = vi.fn();
    render(
      <RemoteImageLoaderProvider load={load} shouldAutoLoad={isAttachment} onOpen={onOpen}>
        <Markdown text={`![board](${ATTACHMENT}.png)`} variant="preview" />
      </RemoteImageLoaderProvider>,
    );
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'Open board on the host' }));

    expect(onOpen).toHaveBeenCalledWith(`${ATTACHMENT}.png`);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says why a load failed and offers the way out on the host', async () => {
    const load = vi.fn().mockRejectedValue(new Error('github.com answered 404'));
    const onOpen = vi.fn();
    render(
      <RemoteImageLoaderProvider load={load} onOpen={onOpen}>
        <Markdown text={`![board](${OTHER_HOST})`} variant="preview" />
      </RemoteImageLoaderProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    await flush();

    expect(screen.queryByText('github.com answered 404')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open on the host' }));
    expect(onOpen).toHaveBeenCalledWith(OTHER_HOST);
  });

  it('drops a late answer after the image changed', async () => {
    let resolveFirst: (value: string) => void = () => undefined;
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue('data:image/png;base64,second');
    const { container, rerender } = render(
      <RemoteImageLoaderProvider load={load} shouldAutoLoad={isAttachment}>
        <Markdown text={`![a](${ATTACHMENT}-one.png)`} variant="preview" />
      </RemoteImageLoaderProvider>,
    );
    rerender(
      <RemoteImageLoaderProvider load={load} shouldAutoLoad={isAttachment}>
        <Markdown text={`![b](${ATTACHMENT}-two.png)`} variant="preview" />
      </RemoteImageLoaderProvider>,
    );
    await flush();
    await act(async () => {
      resolveFirst(PNG_DATA_URI);
      await Promise.resolve();
    });

    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'data:image/png;base64,second',
    );
  });
});

describe('three html shapes', () => {
  it('reads an img tag into an image node', () => {
    expect(
      parseInline({ text: '<img src="https://cdn.acme.dev/a.png" alt="the board" width="400">' }),
    ).toEqual([{ kind: 'image', alt: 'the board', url: 'https://cdn.acme.dev/a.png' }]);
  });

  it('reads a video tag, closed or self closed, into a video node', () => {
    expect(
      parseInline({ text: `<video src="${ATTACHMENT}" controls="controls"></video>` }),
    ).toEqual([{ kind: 'video', url: ATTACHMENT }]);
    expect(parseInline({ text: `<video src="${ATTACHMENT}" muted />` })).toEqual([
      { kind: 'video', url: ATTACHMENT },
    ]);
  });

  it('reads details and summary into a details block', () => {
    const { blocks } = parseMarkdown({
      text: '<details>\n<summary>Logs from ledger-core</summary>\n\nretry **twice**\n</details>',
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: 'details',
      summary: 'Logs from ledger-core',
      isOpen: false,
    });
  });

  it('reads a details block written on one line and an open one', () => {
    const { blocks } = parseMarkdown({
      text: '<details open><summary>Notes</summary>body text</details>',
    });

    expect(blocks[0]).toMatchObject({ kind: 'details', summary: 'Notes', isOpen: true });
  });

  it('opens and closes a details block in place', () => {
    render(<Markdown text={'<details>\n<summary>Notes</summary>\n\nhidden words\n</details>'} />);

    expect(screen.queryByText('hidden words')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    expect(screen.queryByText('hidden words')).not.toBeNull();
  });

  it('draws a video tag as a poster row, not a player', () => {
    const { container } = render(
      <Markdown text={`<video src="${ATTACHMENT}"></video>`} variant="preview" />,
    );

    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('[data-block="video-poster"]')).not.toBeNull();
  });

  it('keeps a script tag out of the page', () => {
    const { container } = render(
      <Markdown text={'<script>window.stolen = 1</script>\n\n<img src="javascript:alert(1)">'} />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(Reflect.get(window, 'stolen')).toBeUndefined();
  });

  it('refuses an img whose address is not a usable address', () => {
    expect(parseInline({ text: '<img src="https://a.dev/x y.png">' })).toEqual([
      { kind: 'text', value: '<img src="https://a.dev/x y.png">' },
    ]);
  });
});

describe('bare attachment addresses', () => {
  it('asks the type once and draws an image', async () => {
    const probe = vi.fn().mockResolvedValue('image');
    const load = vi.fn().mockResolvedValue(PNG_DATA_URI);
    const url = `${ATTACHMENT}-bare-image`;
    const { container } = render(
      <RemoteImageLoaderProvider load={load} shouldAutoLoad={isAttachment} probe={probe}>
        <Markdown text={`Proof\n\n${url}\n\nAnd again\n\n${url}`} variant="preview" />
      </RemoteImageLoaderProvider>,
    );
    await flush();
    await flush();

    expect(probe).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('img')).toHaveLength(2);
  });

  it('draws a video poster when the type is video', async () => {
    const probe = vi.fn().mockResolvedValue('video');
    const url = `${ATTACHMENT}-bare-video`;
    const { container } = render(
      <RemoteImageLoaderProvider load={vi.fn()} shouldAutoLoad={isAttachment} probe={probe}>
        <Markdown text={url} />
      </RemoteImageLoaderProvider>,
    );
    await flush();

    expect(container.querySelector('[data-block="video-poster"]')).not.toBeNull();
  });

  it('leaves the address as text when it is neither', async () => {
    const probe = vi.fn().mockResolvedValue('other');
    const url = `${ATTACHMENT}-bare-other`;
    const { container } = render(
      <RemoteImageLoaderProvider load={vi.fn()} shouldAutoLoad={isAttachment} probe={probe}>
        <Markdown text={url} />
      </RemoteImageLoaderProvider>,
    );
    await flush();

    expect(container.textContent).toBe(url);
  });

  it('never asks about an address off the tool host', () => {
    const probe = vi.fn();
    const { container } = render(
      <RemoteImageLoaderProvider load={vi.fn()} shouldAutoLoad={isAttachment} probe={probe}>
        <Markdown text={'https://cdn.acme.dev/file'} />
      </RemoteImageLoaderProvider>,
    );

    expect(probe).not.toHaveBeenCalled();
    expect(container.textContent).toBe('https://cdn.acme.dev/file');
  });

  it('drops a type answer that arrives after the address left the page', async () => {
    let answer: (value: 'image') => void = () => undefined;
    const probe = vi.fn().mockImplementation(
      () =>
        new Promise<'image'>((resolve) => {
          answer = resolve;
        }),
    );
    const load = vi.fn().mockResolvedValue(PNG_DATA_URI);
    const view = render(
      <RemoteImageLoaderProvider load={load} shouldAutoLoad={isAttachment} probe={probe}>
        <Markdown text={`${ATTACHMENT}-late`} />
      </RemoteImageLoaderProvider>,
    );
    view.unmount();
    await act(async () => {
      answer('image');
      await Promise.resolve();
    });

    expect(load).not.toHaveBeenCalled();
  });
});
