import { describe, expect, it } from 'vitest';
import { PANE_RHYTHM } from '../paneRhythm';

describe('PANE_RHYTHM', () => {
  it('keeps shared pane insets aligned', () => {
    expect(PANE_RHYTHM.header).toContain(PANE_RHYTHM.inset);
    expect(PANE_RHYTHM.body).toContain(PANE_RHYTHM.inset);
    expect(PANE_RHYTHM.dock).toContain(PANE_RHYTHM.inset);
  });

  it('keeps every supported measure available', () => {
    expect(PANE_RHYTHM.measure).toEqual({
      reading: 'max-w-3xl',
      pane: 'max-w-5xl',
      full: 'max-w-none',
      chat: 'max-w-[880px]',
      hero: 'max-w-[640px]',
    });
  });
});
