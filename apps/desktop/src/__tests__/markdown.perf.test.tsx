// @vitest-environment happy-dom

const parseCalls = vi.hoisted(() => ({ count: 0 }));

vi.mock('../../../../packages/ui/src/components/Markdown/parseInline', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../packages/ui/src/components/Markdown/parseInline')
  >('../../../../packages/ui/src/components/Markdown/parseInline');
  return {
    ...actual,
    parseInline: (params: Parameters<typeof actual.parseInline>[0]) => {
      parseCalls.count += 1;
      return actual.parseInline(params);
    },
  };
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Markdown } from '@goodboy/ui';

const WORDS_PER_PARAGRAPH = 20;
const PARAGRAPH_COUNT = 500;
const RERENDER_BUDGET_MS = 500;

const paragraph = (index: number): string =>
  Array.from({ length: WORDS_PER_PARAGRAPH }, (_, word) => `harborline${index}w${word}`).join(' ');

const longAnswer = (): string => {
  const parts = ['## Why ledger-core rejects the change'];
  for (let index = 0; index < PARAGRAPH_COUNT; index += 1) {
    parts.push(paragraph(index));
    if (index % 100 === 50) {
      parts.push('- notify-relay retries\n- payments-api reads the column');
      parts.push('```sql\nALTER TABLE ledger_entries ADD COLUMN settled_at timestamptz;\n```');
    }
  }
  return parts.join('\n\n');
};

describe('a 10,000 word streamed answer', () => {
  afterEach(cleanup);

  it('renders one block when one word is appended to the last paragraph', () => {
    const text = longAnswer();
    const { rerender, container } = render(<Markdown text={text} />);
    const first = container.querySelectorAll('p')[0];
    parseCalls.count = 0;

    const start = performance.now();
    rerender(<Markdown text={`${text} acme`} />);
    const elapsed = performance.now() - start;

    expect(parseCalls.count).toBe(1);
    expect(container.querySelectorAll('p')[0]).toBe(first);
    expect(container.textContent?.endsWith('acme')).toBe(true);
    expect(elapsed).toBeLessThan(RERENDER_BUDGET_MS);
  });

  it('renders only the new block when a paragraph starts', () => {
    const text = longAnswer();
    const { rerender } = render(<Markdown text={text} />);
    parseCalls.count = 0;

    rerender(<Markdown text={`${text}\n\nnorthwind`} />);

    expect(parseCalls.count).toBe(1);
  });

  it('renders every block again when the variant changes', () => {
    const text = 'one\n\ntwo';
    const { rerender } = render(<Markdown text={text} />);
    parseCalls.count = 0;

    rerender(<Markdown text={text} variant="preview" />);

    expect(parseCalls.count).toBe(2);
  });
});
