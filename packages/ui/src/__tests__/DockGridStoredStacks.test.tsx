// @vitest-environment happy-dom

import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DockGrid } from '../components/DockGrid';
import type { DockGridSpec } from '../dockGridSpec';

type RenderParams = {
  readonly stored: DockGridSpec['columns'];
};

const renderStack = ({ stored }: RenderParams) => {
  const spec: DockGridSpec = {
    columns: stored,
    focus: 'page',
    onFocus: () => undefined,
    onTurn: () => undefined,
    onSplit: () => undefined,
  };
  render(
    <DockGrid
      gridRef={createRef<HTMLDivElement>()}
      spec={spec}
      cell={null}
      columns={[
        {
          width: 400,
          dragMax: 600,
          panes: [
            { key: 'terminal', weight: 1 },
            { key: 'browser', weight: 1 },
          ],
        },
      ]}
      handles={[]}
      turn={null}
      isFramed
      isFocusShown={false}
      isFloating={false}
      canDrop={() => true}
      boxesOf={() => null}
    />,
  );
};

afterEach(() => {
  cleanup();
});

describe('the row handle of a stack', () => {
  it('shows for two panels stored in one column', () => {
    renderStack({
      stored: [
        [
          { key: 'terminal', sizing: 'side' },
          { key: 'browser', sizing: 'side' },
        ],
      ],
    });

    expect(screen.getByRole('separator', { name: 'Resize panel height' })).toBeTruthy();
  });

  it('is left out when the solver folded two stored columns into a stack', () => {
    renderStack({
      stored: [[{ key: 'terminal', sizing: 'side' }], [{ key: 'browser', sizing: 'side' }]],
    });

    expect(screen.queryByRole('separator', { name: 'Resize panel height' })).toBeNull();
  });
});
