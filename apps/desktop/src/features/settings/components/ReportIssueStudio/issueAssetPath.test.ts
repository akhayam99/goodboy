import { describe, expect, it } from 'vitest';
import { issueAssetPath } from './issueAssetPath';

const NOW = new Date(Date.UTC(2026, 2, 9, 12, 0, 0));

describe('issueAssetPath', () => {
  it('files the asset under the year and month of the report', () => {
    const path = issueAssetPath({ fileName: 'board.png', index: 0, now: NOW });
    expect(path).toBe(`reports/2026-03/${NOW.getTime()}-01-board.png`);
  });

  it('drops a posix directory prefix from the stored name', () => {
    const path = issueAssetPath({ fileName: '/Users/dev/shots/board.png', index: 1, now: NOW });
    expect(path).toBe(`reports/2026-03/${NOW.getTime()}-02-board.png`);
  });

  it('drops a windows directory prefix from the stored name', () => {
    const path = issueAssetPath({
      fileName: 'C:\\Users\\dev\\shots\\board.png',
      index: 0,
      now: NOW,
    });
    expect(path).toBe(`reports/2026-03/${NOW.getTime()}-01-board.png`);
  });

  it('falls back to a default name when nothing usable survives', () => {
    const path = issueAssetPath({ fileName: 'C:\\shots\\...', index: 0, now: NOW });
    expect(path).toBe(`reports/2026-03/${NOW.getTime()}-01-image.png`);
  });
});
