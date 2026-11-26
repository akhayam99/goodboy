// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DockDragContext } from '../dockDragContext';
import { DockTabsContext, type DockTabs } from '../dockTabsContext';
import { Plus } from '../icons';
import { DockPanelHead } from './DockPanelHead';
import { IconButton } from './IconButton';

afterEach(cleanup);

const tabsOf = (overrides: Partial<DockTabs> = {}): DockTabs => ({
  paneKey: 'terminal',
  options: [
    { value: 'terminal', label: 'Terminal' },
    { value: 'monitor', label: 'Monitor' },
  ],
  shown: 'terminal',
  onSelect: vi.fn(),
  claim: vi.fn(() => vi.fn()),
  ...overrides,
});

const head = (): HTMLElement => {
  const found = document.querySelector<HTMLElement>('[data-dock-panel-head]');
  if (found === null) {
    throw new Error('the head is drawn');
  }
  return found;
};

describe('DockPanelHead', () => {
  it('draws the title, the actions and Close in one row with no grip icon', () => {
    const onClose = vi.fn();
    render(
      <DockPanelHead
        title="Ask"
        actions={<IconButton icon={Plus} label="New question" />}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Ask' })).toBeTruthy();
    expect(
      Array.from(head().querySelectorAll('button')).map((button) =>
        button.getAttribute('aria-label'),
      ),
    ).toEqual(['New question', 'Close']);
    expect(head().querySelector('[data-dock-grip]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is no handle outside a dock cell', () => {
    render(<DockPanelHead title="Ask" onClose={vi.fn()} />);

    expect(head().hasAttribute('data-dock-drag-source')).toBe(false);
    expect(head().className).not.toContain('cursor-grab');
  });

  it('moves the whole cell from the empty area and never from a control', () => {
    const onStart = vi.fn();
    render(
      <DockDragContext.Provider value={{ onStart }}>
        <DockPanelHead title="Ask" onClose={vi.fn()} />
      </DockDragContext.Provider>,
    );

    expect(head().className).toContain('cursor-grab');
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'Ask' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Close' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('starts a single panel drag from a tab segment and a cell drag from the empty area', () => {
    const onStart = vi.fn();
    const onStartPanel = vi.fn();
    render(
      <DockDragContext.Provider value={{ onStart, onStartPanel }}>
        <DockTabsContext.Provider value={tabsOf()}>
          <DockPanelHead title="Terminal" onClose={vi.fn()} />
        </DockTabsContext.Provider>
      </DockDragContext.Provider>,
    );

    fireEvent.pointerDown(screen.getByRole('tab', { name: 'Monitor' }));
    expect(onStartPanel).toHaveBeenCalledTimes(1);
    expect(onStartPanel.mock.calls[0]?.[0]).toMatchObject({ key: 'monitor' });
    expect(onStart).not.toHaveBeenCalled();

    fireEvent.pointerDown(head());
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('takes the place of the cell tab strip and switches panels', () => {
    const tabs = tabsOf();
    render(
      <DockTabsContext.Provider value={tabs}>
        <DockPanelHead title="Terminal" onClose={vi.fn()} />
      </DockTabsContext.Provider>,
    );

    expect(screen.queryByRole('heading', { name: 'Terminal' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Monitor' }));
    expect(tabs.onSelect).toHaveBeenCalledWith({ key: 'monitor' });
    expect(tabs.claim).toHaveBeenCalledWith({ paneKey: 'terminal' });
  });
});
