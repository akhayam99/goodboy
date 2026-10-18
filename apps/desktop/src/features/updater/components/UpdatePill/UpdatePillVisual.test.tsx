// @vitest-environment happy-dom
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { UpdatePillVisual } from './UpdatePillVisual';

const STYLES_CSS = readFileSync(join(__dirname, '..', '..', '..', '..', 'styles.css'), 'utf8');

const LONG_VERSION = '0.27.2-beta.20261017.preview.build.8f3c2a91e7d54b6fa0c1d2e3f4a5b6c7';

const animationTokensIn = ({ root }: { readonly root: Element }): ReadonlyArray<string> =>
  [root, ...root.querySelectorAll('*')].flatMap((node) =>
    [...node.classList]
      .map((token) => /(?:^|:)animate-([a-z-]+)$/.exec(token)?.[1])
      .filter((name): name is string => name !== undefined),
  );

const animationValueOf = ({ name }: { readonly name: string }): string => {
  const match = new RegExp(`--animate-${name}:([^;]+);`).exec(STYLES_CSS);
  if (match === null) {
    throw new Error(`styles.css has no --animate-${name} token`);
  }
  return match[1] ?? '';
};

const pillRoot = (): Element => {
  const root = screen.getByTestId('update-pill').parentElement;
  if (root === null) {
    throw new Error('the update pill has no wrapper');
  }
  return root;
};

type ClassesParams = {
  readonly element: Element;
};

const classesOf = ({ element }: ClassesParams): ReadonlyArray<string> => [...element.classList];

afterEach(cleanup);

describe('UpdatePillVisual', () => {
  it('shows the version and nothing else, so it fits its row', () => {
    render(<UpdatePillVisual state="ready" version="0.27.2" />);

    expect(screen.getByTestId('update-pill').textContent).toBe('0.27.2');
  });

  it('stays on one line and truncates the version before it overflows', () => {
    render(<UpdatePillVisual state="available" version={LONG_VERSION} />);

    const pill = screen.getByTestId('update-pill');
    const version = pill.querySelector('[data-update-pill-version]');
    if (version === null) {
      throw new Error('the pill has no version text');
    }
    expect(classesOf({ element: pill })).toEqual(
      expect.arrayContaining(['whitespace-nowrap', 'min-w-0', 'max-w-full', 'shrink']),
    );
    expect(classesOf({ element: pill })).not.toContain('shrink-0');
    expect(classesOf({ element: version })).toEqual(
      expect.arrayContaining(['truncate', 'min-w-0']),
    );
    expect(classesOf({ element: pillRoot() })).toEqual(
      expect.arrayContaining(['min-w-0', 'max-w-full']),
    );
    expect(version.textContent).toBe(LONG_VERSION);
  });

  it('enters with one finite animation', () => {
    render(<UpdatePillVisual state="ready" version="0.27.2" />);

    const tokens = animationTokensIn({ root: pillRoot() });

    expect(tokens).toHaveLength(1);
    expect(tokens.map((name) => animationValueOf({ name })).join(' ')).not.toContain('infinite');
  });

  it('keeps the same node when the state changes, so the entry never replays', () => {
    const { rerender } = render(<UpdatePillVisual state="ready" version="0.27.2" />);
    const before = pillRoot();

    rerender(<UpdatePillVisual state="queued" version="0.27.2" />);

    expect(pillRoot()).toBe(before);
    expect(screen.getByTestId('update-pill').textContent).toBe('0.27.2');
  });
});
