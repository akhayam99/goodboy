// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { ILink } from '@xterm/xterm';
import { createFileLinkProvider } from './fileLinkProvider';

type LinksParams = {
  readonly lines: ReadonlyArray<string>;
  readonly row: number;
};

const linksOf = ({ lines, row }: LinksParams) => {
  const onOpen = vi.fn();
  const provider = createFileLinkProvider({ lineAt: ({ index }) => lines[index], onOpen });
  let links: ReadonlyArray<ILink> | undefined;
  provider.provideLinks(row, (found) => {
    links = found;
  });
  return { links, onOpen };
};

describe('createFileLinkProvider', () => {
  it('links a path with a line over the cells it occupies', () => {
    const { links } = linksOf({ lines: ['FAIL src/rounding.ts:42:13'], row: 1 });

    expect(links?.map((link) => link.text)).toEqual(['src/rounding.ts:42:13']);
    expect(links?.[0]?.range).toEqual({ start: { x: 6, y: 1 }, end: { x: 26, y: 1 } });
  });

  it('offers no link on a line without a path', () => {
    expect(linksOf({ lines: ['all green'], row: 1 }).links).toBeUndefined();
    expect(linksOf({ lines: [], row: 4 }).links).toBeUndefined();
  });

  it('opens only with the platform modifier, a plain click stays a selection', () => {
    const { links, onOpen } = linksOf({ lines: ['at src/queue.ts:9'], row: 1 });

    links?.[0]?.activate(new MouseEvent('click'), 'src/queue.ts:9');
    expect(onOpen).not.toHaveBeenCalled();

    links?.[0]?.activate(new MouseEvent('click', { metaKey: true }), 'src/queue.ts:9');
    links?.[0]?.activate(new MouseEvent('click', { ctrlKey: true }), 'src/queue.ts:9');
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenCalledWith({ path: 'src/queue.ts', line: 9, column: null });
  });
});
