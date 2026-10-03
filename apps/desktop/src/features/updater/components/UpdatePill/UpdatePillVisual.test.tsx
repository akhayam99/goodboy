// @vitest-environment happy-dom
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { UpdatePillVisual } from './UpdatePillVisual';

const STYLES_CSS = readFileSync(join(__dirname, '..', '..', '..', '..', 'styles.css'), 'utf8');

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

afterEach(cleanup);

describe('UpdatePillVisual', () => {
  it('names the new version and enters with one finite animation', () => {
    render(<UpdatePillVisual isQueued={false} isReady version="0.15.6" agentCount={0} />);

    const tokens = animationTokensIn({ root: pillRoot() });

    screen.getByText('0.15.6 ready');
    expect(tokens).toHaveLength(1);
    expect(tokens.map((name) => animationValueOf({ name })).join(' ')).not.toContain('infinite');
  });

  it('keeps the same node when the running count changes, so the entry never replays', () => {
    const { rerender } = render(
      <UpdatePillVisual isQueued isReady={false} version="0.15.6" agentCount={2} />,
    );
    const before = pillRoot();

    rerender(<UpdatePillVisual isQueued isReady={false} version="0.15.6" agentCount={1} />);

    expect(pillRoot()).toBe(before);
    screen.getByText('Restarts after 1 agent');
  });
});
