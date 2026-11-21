// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { dockFitProbe } from '../dockFitProbe';
import type { DockGridCell } from '../dockGridSpec';
import { useDockGrid } from '../useDockGrid';
import { useDrawerTierWidthSet } from '../useDrawerTierWidthSet';

type GridProps = {
  readonly keys: ReadonlyArray<string>;
};

const cellOf = ({ key }: { readonly key: string }): DockGridCell => ({ key, sizing: 'side' });

const mountGrid = ({ keys }: GridProps) =>
  renderHook(
    (props: GridProps) => {
      const tiers = useDrawerTierWidthSet({ onPreview: () => undefined });
      return useDockGrid({
        columns: props.keys.map((key) => [cellOf({ key })]),
        splits: {},
        cellCount: props.keys.length,
        onResize: () => undefined,
        columnWidth: 400,
        railWidth: 0,
        placement: 'auto',
        detail: { isShown: false, sizing: 'reader', savedWidth: 600 },
        tiers,
        route: { current: () => undefined },
        previewDock: () => undefined,
        solve: ({ columns }) => ({
          mode: columns.length > 1 ? 'push' : 'over',
          isStacked: false,
          isDetailOver: false,
          detail: null,
          columns: [],
        }),
        resizeLabel: 'Resize panel',
      });
    },
    { initialProps: { keys } },
  );

const foldsIntoOne = () => dockFitProbe.fits({ columns: [['terminal', 'browser']] });

afterEach(() => {
  cleanup();
});

describe('the fit probe of the dock', () => {
  it('stays unset while the dock holds one panel', () => {
    mountGrid({ keys: ['terminal'] });

    expect(foldsIntoOne()).toBe(true);
  });

  it('is kept when a dock with one panel mounts after the dock with two', () => {
    mountGrid({ keys: ['terminal', 'browser'] });
    mountGrid({ keys: ['monitoring'] });

    expect(foldsIntoOne()).toBe(false);
  });

  it('is published once the dock grows to two panels and dropped when it shrinks', () => {
    const grid = mountGrid({ keys: ['terminal'] });

    grid.rerender({ keys: ['terminal', 'browser'] });
    expect(foldsIntoOne()).toBe(false);

    grid.rerender({ keys: ['terminal'] });
    expect(foldsIntoOne()).toBe(true);
  });
});
