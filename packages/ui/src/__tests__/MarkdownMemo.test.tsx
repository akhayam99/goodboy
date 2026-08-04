// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { Markdown } from '../components/Markdown';

const parseCalls = vi.fn();

vi.mock('../components/Markdown/parseMarkdown', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/Markdown/parseMarkdown')>();
  return {
    ...actual,
    parseMarkdown: (params: { readonly text: string }) => {
      parseCalls();
      return actual.parseMarkdown(params);
    },
  };
});

afterEach(() => {
  cleanup();
  parseCalls.mockClear();
});

const TEXT = ['# Title', '', 'Body with `code` and a [link](https://example.com).'].join('\n');

let rerenderParent: (() => void) | null = null;

const Parent = () => {
  const [tick, setTick] = useState(0);
  rerenderParent = () => setTick((value) => value + 1);
  return (
    <div>
      <span data-testid="tick">{tick}</span>
      <Markdown text={TEXT} />
    </div>
  );
};

describe('Markdown parsing cost', () => {
  it('parses the text once across repeated parent renders', () => {
    const { getByTestId } = render(<Parent />);

    for (let index = 0; index < 20; index += 1) {
      act(() => rerenderParent?.());
    }

    expect(getByTestId('tick').textContent).toBe('20');
    expect(parseCalls).toHaveBeenCalledTimes(1);
  });

  it('parses again when the text changes', () => {
    const { rerender } = render(<Markdown text="one" />);
    rerender(<Markdown text="two" />);

    expect(parseCalls).toHaveBeenCalledTimes(2);
  });
});
