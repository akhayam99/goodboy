import { describe, expect, it } from 'vitest';
import { updateMarkOf, updateProgressPercent } from './updateMark';

describe('updateProgressPercent', () => {
  it('is null without a total', () => {
    expect(updateProgressPercent({ progress: null })).toBeNull();
    expect(updateProgressPercent({ progress: { downloaded: 10, total: null } })).toBeNull();
    expect(updateProgressPercent({ progress: { downloaded: 10, total: 0 } })).toBeNull();
  });

  it('rounds and stays between 0 and 100', () => {
    expect(updateProgressPercent({ progress: { downloaded: 1, total: 3 } })).toBe(33);
    expect(updateProgressPercent({ progress: { downloaded: 900, total: 300 } })).toBe(100);
  });
});

describe('updateMarkOf, one mark for each of the six update states', () => {
  it('shows an arrow and the word Update when one is available', () => {
    expect(updateMarkOf({ state: 'available', status: 'available', progress: null })).toEqual({
      glyph: 'arrow',
      tone: 'primary',
      isEdged: false,
      isDownloading: false,
      percent: null,
      word: 'Update',
    });
  });

  it('shows the percent while it downloads, in the same tone', () => {
    const mark = updateMarkOf({
      state: 'available',
      status: 'downloading-bg',
      progress: { downloaded: 42, total: 100 },
    });
    expect(mark.isDownloading).toBe(true);
    expect(mark.percent).toBe(42);
    expect(mark.word).toBe('42%');
    expect(mark.tone).toBe('primary');
  });

  it('keeps the word Update while the size is not known yet', () => {
    const mark = updateMarkOf({
      state: 'available',
      status: 'downloading-bg',
      progress: { downloaded: 0, total: null },
    });
    expect(mark.isDownloading).toBe(true);
    expect(mark.percent).toBeNull();
    expect(mark.word).toBe('Update');
  });

  it.each(['ready', 'running', 'queued'] as const)('edges the arrow when %s', (state) => {
    const mark = updateMarkOf({ state, status: 'ready', progress: null });
    expect(mark).toMatchObject({ glyph: 'arrow', tone: 'primary', isEdged: true });
    expect(mark.isDownloading).toBe(false);
  });

  it('keeps the ready mark while the install restarts, with no progress', () => {
    const mark = updateMarkOf({ state: 'ready', status: 'downloading', progress: null });
    expect(mark.isDownloading).toBe(false);
  });

  it('warns in danger when it failed', () => {
    expect(updateMarkOf({ state: 'failed', status: 'available', progress: null })).toMatchObject({
      glyph: 'alert',
      tone: 'danger',
      isEdged: true,
    });
  });
});
