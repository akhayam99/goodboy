import { describe, expect, it } from 'vitest';
import { outputPreview } from './outputPreview';

describe('outputPreview', () => {
  it('drops control markers and collapses the text to one line', () => {
    const text = 'Mapped 12 files.\n\n<<ctx-decision>>keep 13.3<</ctx-decision>>\nDone.';
    expect(outputPreview({ text })).toBe('Mapped 12 files. Done.');
  });

  it('drops a self closing marker', () => {
    expect(outputPreview({ text: 'All set <<step-done id="abc">>' })).toBe('All set');
  });

  it('returns an empty string for missing text', () => {
    expect(outputPreview({ text: null })).toBe('');
  });
});
