import { describe, expect, it } from 'vitest';
import { pageChipTextOf } from './pageChipTextOf';
import type { PageSource } from '../../shared/types/pageSource';

const SOURCE: PageSource = {
  kind: 'page',
  title: 'Checkout',
  host: 'localhost:5173',
  url: 'http://localhost:5173/checkout',
  wordCount: 1_240,
  readAt: 1_000_000,
  iconSrc: null,
};

describe('pageChipTextOf', () => {
  it('shows the title, then the host and the word count', () => {
    const text = pageChipTextOf({ source: SOURCE, now: SOURCE.readAt });

    expect(text.title).toBe('Checkout');
    expect(text.detail).toBe('localhost:5173 · 1.2k words');
  });

  it('counts a small page in whole words', () => {
    expect(pageChipTextOf({ source: { ...SOURCE, wordCount: 1 }, now: 0 }).detail).toBe(
      'localhost:5173 · 1 word',
    );
    expect(pageChipTextOf({ source: { ...SOURCE, wordCount: 640 }, now: 0 }).detail).toBe(
      'localhost:5173 · 640 words',
    );
  });

  it('says when the page was read once it is older than a minute', () => {
    const fresh = pageChipTextOf({ source: SOURCE, now: SOURCE.readAt + 59_000 });
    const old = pageChipTextOf({ source: SOURCE, now: SOURCE.readAt + 61_000 });

    expect(fresh.hover).toBe('http://localhost:5173/checkout');
    expect(old.hover).toContain('Read at');
  });
});
