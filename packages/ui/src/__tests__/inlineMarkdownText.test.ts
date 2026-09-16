import { describe, expect, it } from 'vitest';
import { inlineMarkdownText } from '../components/Markdown/inlineMarkdownText';

describe('inlineMarkdownText', () => {
  it('keeps plain text untouched', () => {
    expect(inlineMarkdownText({ text: 'Release readout' })).toBe('Release readout');
  });

  it('unwraps bold, italic and strikethrough', () => {
    expect(inlineMarkdownText({ text: '**Checks** _and_ ~~gates~~' })).toBe('Checks and gates');
  });

  it('keeps the label of a link and drops its target', () => {
    expect(inlineMarkdownText({ text: '[Checks](https://example.com/checks)' })).toBe('Checks');
  });

  it('keeps the body of inline code', () => {
    expect(inlineMarkdownText({ text: 'run `pnpm test` first' })).toBe('run pnpm test first');
  });

  it('keeps the alt text of an image', () => {
    expect(inlineMarkdownText({ text: '![Coverage](https://example.com/c.png)' })).toBe('Coverage');
  });

  it('reads a context tag as the word its chip shows', () => {
    expect(inlineMarkdownText({ text: '<<ctx-goal>> ship it' })).toBe('goal ship it');
  });

  it('leaves an unterminated delimiter alone', () => {
    expect(inlineMarkdownText({ text: '**Checks' })).toBe('**Checks');
  });
});
