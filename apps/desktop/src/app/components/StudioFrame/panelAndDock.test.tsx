import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useContext } from 'react';
import { AppShell, DockCellContext, type DockGridSpec } from '@goodboy/ui';
import { useStudioDrawer } from '../../../shared/hooks/useStudioDrawer';
import { StudioFrame } from './index';

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

type WidthParams = {
  readonly width: number;
};

const stubColumnWidth = ({ width }: WidthParams) => {
  class StubObserver {
    private readonly callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }
    observe() {
      this.callback([{ contentRect: { width } }]);
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', StubObserver);
};

type BodyProps = {
  readonly onClosePanel: () => void;
};

const Body = ({ onClosePanel }: BodyProps) => {
  useStudioDrawer({
    node: <p>payments-api task</p>,
    drawerKey: 'payments-api#12',
    onClose: onClosePanel,
    ariaLabel: 'Task',
    resizeLabel: 'Resize the task pane',
    sizing: 'reader',
  });
  return <p>Tasks list</p>;
};

type ShellParams = {
  readonly hasDock: boolean;
  readonly onClosePanel: () => void;
  readonly dockGrid?: DockGridSpec | null;
};

const DockCell = () => {
  const key = useContext(DockCellContext);
  return <p>{key === null ? 'Terminal dock' : `${key} pane`}</p>;
};

const shell = ({ hasDock, onClosePanel, dockGrid = null }: ShellParams) => (
  <AppShell
    leftRail={<nav aria-label="Places" />}
    main={<div>board</div>}
    drawer={hasDock ? <DockCell /> : null}
    dockGrid={dockGrid}
    isDockInStudio
    studio={
      <StudioFrame kind="inbox" placement="content" onClose={() => undefined}>
        <Body onClosePanel={onClosePanel} />
      </StudioFrame>
    }
  />
);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const containerOf = (name: 'detail' | 'drawer'): Element | null =>
  document.querySelector(`[data-studio-slot="content"] [data-container="${name}"]`);

describe('the page panel and the tool dock on Tasks', () => {
  it('shows both, the page panel left of the dock and the dock inside the page frame', () => {
    stubColumnWidth({ width: 2200 });
    const onClosePanel = vi.fn();
    render(shell({ hasDock: true, onClosePanel }));

    const detail = containerOf('detail');
    const drawer = containerOf('drawer');
    expect(detail?.textContent).toContain('payments-api task');
    expect(drawer?.textContent).toContain('Terminal dock');
    expect(
      detail !== null &&
        drawer !== null &&
        (detail.compareDocumentPosition(drawer) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    ).toBe(true);
    expect(document.querySelectorAll('[data-drawer-card]')).toHaveLength(1);
    expect(onClosePanel).not.toHaveBeenCalled();
  });

  it('keeps the page panel open when the dock opens after it', () => {
    stubColumnWidth({ width: 2200 });
    const onClosePanel = vi.fn();
    const view = render(shell({ hasDock: false, onClosePanel }));
    expect(containerOf('drawer')?.textContent ?? '').not.toContain('Terminal dock');

    view.rerender(shell({ hasDock: true, onClosePanel }));

    expect(containerOf('detail')?.textContent).toContain('payments-api task');
    expect(containerOf('drawer')?.textContent).toContain('Terminal dock');
    expect(onClosePanel).not.toHaveBeenCalled();
  });

  it('draws the grid of tools inside the page frame, between the page panel and the rail', () => {
    stubColumnWidth({ width: 2600 });
    const onClosePanel = vi.fn();
    const dockGrid: DockGridSpec = {
      columns: [[{ key: 'terminal', sizing: 'side' }], [{ key: 'browser', sizing: 'browser' }]],
      focus: 'terminal',
      onFocus: () => undefined,
      onTurn: () => undefined,
    };
    render(shell({ hasDock: true, onClosePanel, dockGrid }));

    const drawer = containerOf('drawer');
    const panes = Array.from(drawer?.querySelectorAll('[data-dock-pane]') ?? []).map((pane) =>
      pane.getAttribute('data-dock-pane'),
    );
    expect(panes).toEqual(['terminal', 'browser']);
    expect(drawer?.textContent).toContain('terminal pane');
    expect(drawer?.textContent).toContain('browser pane');
    expect(drawer?.textContent).not.toContain('Terminal dock');
    const detail = containerOf('detail');
    expect(
      detail !== null &&
        drawer !== null &&
        (detail.compareDocumentPosition(drawer) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    ).toBe(true);
    const rail = drawer?.querySelector('[data-drawer-edge]');
    expect(rail?.querySelector('[role="toolbar"]')).not.toBeNull();
    expect(drawer?.lastElementChild).toBe(rail);
    expect(onClosePanel).not.toHaveBeenCalled();
  });
});
