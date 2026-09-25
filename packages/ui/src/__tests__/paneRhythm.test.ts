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

  it('holds one content column and one hero measure', () => {
    expect(PANE_RHYTHM.column).toBe('mx-auto w-full max-w-[var(--column-max)]');
    expect(PANE_RHYTHM.hero).toBe('max-w-[640px]');
    expect(Object.keys(PANE_RHYTHM)).not.toContain('measure');
  });
});
