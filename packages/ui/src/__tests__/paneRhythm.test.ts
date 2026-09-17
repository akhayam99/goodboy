import { describe, expect, it } from 'vitest';
import { PANE_RHYTHM } from '../paneRhythm';

describe('PANE_RHYTHM', () => {
  it('keeps shared pane insets aligned', () => {
    expect(PANE_RHYTHM.header).toContain(PANE_RHYTHM.inset);
    expect(PANE_RHYTHM.body).toContain(PANE_RHYTHM.inset);
    expect(PANE_RHYTHM.dock).toContain(PANE_RHYTHM.inset);
    expect(PANE_RHYTHM.detail.band).toContain(PANE_RHYTHM.inset);
    expect(PANE_RHYTHM.detail.body).toContain(PANE_RHYTHM.inset);
  });

  it('keeps the detail band shorter than the pane header it replaces', () => {
    expect(PANE_RHYTHM.detail.band).toBe('px-6 py-2');
    expect(PANE_RHYTHM.header).toBe('px-6 py-5');
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
