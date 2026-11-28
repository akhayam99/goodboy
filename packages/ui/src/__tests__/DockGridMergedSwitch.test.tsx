// @vitest-environment happy-dom

import { createRef, useContext, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DockGrid } from '../components/DockGrid';
import { DockPanelHead } from '../components/DockPanelHead';
import { DockCellContext } from '../dockCellContext';
import type { DockGridCell, DockGridSpec } from '../dockGridSpec';

const BROWSER: DockGridCell = {
  key: 'browser',
  sizing: 'browser',
  label: 'Browser',
  tabs: {
    keys: ['browser', 'terminal'],
    active: 'browser',
    members: [{ key: 'terminal', sizing: 'side', label: 'Terminal' }],
  },
};

const Body = () => {
  const shown = useContext(DockCellContext);
  return (
    <>
      <DockPanelHead title="Panel" onClose={() => undefined} />
      <p data-testid="shown">{shown}</p>
    </>
  );
};

const Harness = () => {
  const [focus, setFocus] = useState('browser');
  const spec: DockGridSpec = {
    columns: [[BROWSER]],
    focus,
    onFocus: ({ key }) => setFocus(key),
    onMove: () => undefined,
  };
  return (
    <DockGrid
      gridRef={createRef<HTMLDivElement>()}
      spec={spec}
      cell={<Body />}
      columns={[
        {
          width: 500,
          dragMax: 700,
          panes: [{ key: 'browser', weight: 1, tabs: ['browser', 'terminal'] }],
        },
      ]}
      handles={[]}
      isFramed
      isFocusShown
      isFloating={false}
      canDrop={() => true}
      boxesOf={() => null}
    />
  );
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const press = ({ name }: { readonly name: string }): void => {
  fireEvent.pointerDown(screen.getByRole('tab', { name }), { button: 0, pointerId: 1 });
  fireEvent.pointerUp(screen.getByRole('tab', { name }), { button: 0, pointerId: 1 });
  fireEvent.click(screen.getByRole('tab', { name }));
};

describe('the switcher of a merged dock slot', () => {
  it('goes from one tool to the other and back with a click, without capturing the pointer on a press', () => {
    const capture = vi.fn();
    HTMLElement.prototype.setPointerCapture = capture;
    render(<Harness />);

    press({ name: 'Terminal' });
    expect(screen.getByTestId('shown').textContent).toBe('terminal');
    press({ name: 'Browser' });
    expect(screen.getByTestId('shown').textContent).toBe('browser');
    expect(capture).not.toHaveBeenCalled();
  });

  it('switches with the arrow keys both ways', () => {
    render(<Harness />);
    screen.getByRole('tab', { name: 'Browser' }).focus();

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Browser' }), { key: 'ArrowRight' });
    expect(screen.getByTestId('shown').textContent).toBe('terminal');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Terminal' }), { key: 'ArrowLeft' });
    expect(screen.getByTestId('shown').textContent).toBe('browser');
  });
});
