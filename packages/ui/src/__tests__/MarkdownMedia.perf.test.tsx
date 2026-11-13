import { describe, expect, it } from 'vitest';
import { parseInline } from '../components/Markdown/parseInline';
import { parseMarkdown } from '../components/Markdown/parseMarkdown';

describe('untrusted html patterns', () => {
  it('reads a long run of attributes in linear time', () => {
    const attributes = ' a="1"'.repeat(5000);
    const input = `<img${attributes}`;
    const start = performance.now();
    parseInline({ text: input });
    parseMarkdown({ text: `${input}\n${input}` });

    expect(performance.now() - start).toBeLessThan(500);
  });

  it('reads many unclosed tags in linear time', () => {
    const input = '<details>\n<summary>x'.repeat(4000);
    const start = performance.now();
    parseMarkdown({ text: input });

    expect(performance.now() - start).toBeLessThan(1000);
  });
});
