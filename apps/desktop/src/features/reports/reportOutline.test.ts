import { describe, expect, it } from 'vitest';
import { buildReportOutline } from './reportOutline';

describe('buildReportOutline', () => {
  it('lists headings down to level three in document order', () => {
    const outline = buildReportOutline({
      markdown: ['# Outcome', 'text', '## What landed', '### Detail', '#### Ignored'].join('\n'),
    });
    expect(outline.map((entry) => entry.title)).toEqual(['Outcome', 'What landed', 'Detail']);
    expect(outline.map((entry) => entry.level)).toEqual([1, 2, 3]);
  });

  it('skips headings inside a fenced block', () => {
    const outline = buildReportOutline({
      markdown: ['# Real', '```md', '# Fake', '```'].join('\n'),
    });
    expect(outline.map((entry) => entry.title)).toEqual(['Real']);
  });

  it('gives every entry a unique id even when titles repeat', () => {
    const outline = buildReportOutline({ markdown: ['## Risk', 'a', '## Risk'].join('\n') });
    expect(new Set(outline.map((entry) => entry.id)).size).toBe(2);
  });

  it('returns nothing for a report without headings', () => {
    expect(buildReportOutline({ markdown: 'just a paragraph' })).toEqual([]);
  });
});
