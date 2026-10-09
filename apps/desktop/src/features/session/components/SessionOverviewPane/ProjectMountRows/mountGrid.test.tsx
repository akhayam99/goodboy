// @vitest-environment happy-dom

import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MOUNT_ROW_HEIGHT, mountGridTracksOf } from './mountGrid';
import { MountTrackGrid } from './MountTrackGrid';
import { MountSkeletonRows } from './MountSkeletonRows';

const sourceOf = ({ file }: { readonly file: string }): string =>
  readFileSync(join(__dirname, file), 'utf8');

describe('mountGridTracksOf', () => {
  it.each([
    { index: 0, track: 'minmax(0,1fr)', name: 'branch, flexible' },
    { index: 1, track: '96px', name: 'pull request' },
    { index: 2, track: '120px', name: 'changes' },
    { index: 3, track: '96px', name: 'action' },
  ])('track $index is $track ($name)', ({ index, track }) => {
    expect(mountGridTracksOf()[index]).toBe(track);
  });

  it('has four tracks and joins them into one template', () => {
    expect(mountGridTracksOf()).toHaveLength(4);
    expect(mountGridTracksOf().join(' ')).toBe('minmax(0,1fr) 96px 120px 96px');
  });

  it('fixes a mount row at 36px', () => {
    expect(MOUNT_ROW_HEIGHT).toBe(36);
  });
});

describe('the mount grids', () => {
  afterEach(cleanup);

  it('sets its columns from the function and says so in a data attribute', () => {
    render(<MountTrackGrid>cells</MountTrackGrid>);

    const grid = screen.getByText('cells');
    expect(grid.getAttribute('data-mount-grid')).toBe(mountGridTracksOf().join(' '));
    expect(grid.style.gridTemplateColumns).toBe(mountGridTracksOf().join(' '));
  });

  it('draws the skeleton rows on the same tracks at the same height', () => {
    render(<MountSkeletonRows />);

    const [grid] = Array.from(document.querySelectorAll('[data-mount-grid]'));
    expect(grid?.getAttribute('data-mount-grid')).toBe(mountGridTracksOf().join(' '));
    const rows = screen.getAllByTestId('mount-skeleton-row');
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => expect(row.style.height).toBe(`${MOUNT_ROW_HEIGHT}px`));
  });

  it.each(['index.tsx', 'ProjectMountGroup.tsx', 'MountSkeletonRows.tsx'])(
    'draws the columns of %s through MountTrackGrid, never by hand',
    (file) => {
      const source = sourceOf({ file });

      expect(source).toContain('<MountTrackGrid');
      expect(source).not.toMatch(/grid-cols-\[minmax/);
    },
  );

  it('sizes the row and its skeleton from MOUNT_ROW_HEIGHT', () => {
    expect(sourceOf({ file: 'ProjectMountRow.tsx' })).toContain('MOUNT_ROW_HEIGHT');
    expect(sourceOf({ file: 'MountSkeletonRows.tsx' })).toContain('MOUNT_ROW_HEIGHT');
    expect(sourceOf({ file: 'MountTrackGrid.tsx' })).toContain('mountGridTracksOf');
  });
});
