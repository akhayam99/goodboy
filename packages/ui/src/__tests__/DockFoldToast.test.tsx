// @vitest-environment happy-dom

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DockGridColumnBox } from '../dockGridColumnBox';
import { useDockFoldReport, type DockFold } from '../useDockFoldReport';

afterEach(cleanup);

const column = ({ keys }: { readonly keys: ReadonlyArray<string> }): DockGridColumnBox => ({
  width: 400,
  dragMax: 560,
  panes: [{ key: keys[0] ?? '', weight: 1, tabs: keys.length > 1 ? keys : [] }],
});

type HarnessProps = {
  readonly scope?: string;
  readonly keys: ReadonlyArray<string>;
  readonly columns: ReadonlyArray<DockGridColumnBox>;
};

const mount = ({
  onFold,
  ...first
}: HarnessProps & { readonly onFold: (fold: DockFold) => void }) =>
  renderHook((props: HarnessProps) => useDockFoldReport({ ...props, onFold }), {
    initialProps: first,
  });

describe('the fold report', () => {
  it('says nothing for a layout that is already folded when it first shows', () => {
    const onFold = vi.fn();

    mount({
      onFold,
      keys: ['browser', 'terminal'],
      columns: [column({ keys: ['browser', 'terminal'] })],
    });

    expect(onFold).not.toHaveBeenCalled();
  });

  it('reports the panel that was opened and the panel that folded because of it', () => {
    const onFold = vi.fn();
    const view = mount({ onFold, keys: ['browser'], columns: [column({ keys: ['browser'] })] });

    view.rerender({
      keys: ['browser', 'monitoring'],
      columns: [column({ keys: ['browser', 'monitoring'] })],
    });

    expect(onFold).toHaveBeenCalledTimes(1);
    expect(onFold).toHaveBeenCalledWith({
      opened: 'monitoring',
      folds: [{ key: 'monitoring', into: 'browser' }],
    });
  });

  it('says nothing when the panels only fold because the window shrank', () => {
    const onFold = vi.fn();
    const view = mount({
      onFold,
      keys: ['browser', 'monitoring'],
      columns: [column({ keys: ['browser'] }), column({ keys: ['monitoring'] })],
    });

    view.rerender({
      keys: ['browser', 'monitoring'],
      columns: [column({ keys: ['browser', 'monitoring'] })],
    });

    expect(onFold).not.toHaveBeenCalled();
  });

  it('says nothing when the panel that opened fits beside the others', () => {
    const onFold = vi.fn();
    const view = mount({ onFold, keys: ['browser'], columns: [column({ keys: ['browser'] })] });

    view.rerender({
      keys: ['browser', 'terminal'],
      columns: [column({ keys: ['browser'] }), column({ keys: ['terminal'] })],
    });

    expect(onFold).not.toHaveBeenCalled();
  });

  it('says nothing when another session brings its own folded layout', () => {
    const onFold = vi.fn();
    const view = mount({
      onFold,
      scope: 'session-1',
      keys: ['browser'],
      columns: [column({ keys: ['browser'] })],
    });

    view.rerender({
      scope: 'session-2',
      keys: ['browser', 'monitoring'],
      columns: [column({ keys: ['browser', 'monitoring'] })],
    });

    expect(onFold).not.toHaveBeenCalled();
  });
});
