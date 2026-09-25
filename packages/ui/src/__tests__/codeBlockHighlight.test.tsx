// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { Markdown } from '../components/Markdown';
import {
  CodeHighlighterContext,
  type CodeHighlighter,
  type CodeLines,
} from '../components/Markdown/codeHighlighter';

afterEach(cleanup);

const SOURCE = 'const tenant = "northwind";\nreturn tenant;';
const TEXT = '```ts\n' + SOURCE + '\n```';

const LINES: CodeLines = [
  [
    { text: 'const', kind: 'keyword' },
    { text: ' tenant = ', kind: 'plain' },
    { text: '"northwind"', kind: 'string' },
    { text: ';', kind: 'punctuation' },
  ],
  [
    { text: 'return', kind: 'keyword' },
    { text: ' tenant;', kind: 'plain' },
  ],
];

const highlighterWith = (lines: CodeLines | null): CodeHighlighter => ({
  highlight: vi.fn(async () => lines),
  peek: vi.fn(() => undefined),
});

describe('markdown code blocks', () => {
  it('render plain text without a highlighter', () => {
    const { container } = render(<Markdown text={TEXT} />);
    const code = container.querySelector('pre code');
    expect(code?.textContent).toBe(SOURCE);
    expect(code?.querySelector('span')).toBeNull();
  });

  it('color tokens once the app highlighter answers, keeping the text', async () => {
    const highlighter = highlighterWith(LINES);
    const { container } = render(
      <CodeHighlighterContext.Provider value={highlighter}>
        <Markdown text={TEXT} />
      </CodeHighlighterContext.Provider>,
    );
    expect(highlighter.highlight).toHaveBeenCalledWith(SOURCE, 'ts');
    await waitFor(() =>
      expect(container.querySelector('.text-syntax-keyword')?.textContent).toBe('const'),
    );
    expect(container.querySelector('.text-syntax-string')?.textContent).toBe('"northwind"');
    expect(container.querySelector('pre code')?.textContent).toBe(SOURCE);
  });

  it('stays plain when the language is unknown to the highlighter', async () => {
    const highlighter = highlighterWith(null);
    const { container } = render(
      <CodeHighlighterContext.Provider value={highlighter}>
        <Markdown text={TEXT} />
      </CodeHighlighterContext.Provider>,
    );
    await waitFor(() => expect(highlighter.highlight).toHaveBeenCalled());
    expect(container.querySelector('pre code span')).toBeNull();
  });
});
