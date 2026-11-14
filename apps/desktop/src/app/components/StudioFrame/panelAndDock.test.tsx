import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { AppShell } from '@goodboy/ui';
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
};

const shell = ({ hasDock, onClosePanel }: ShellParams) => (
  <AppShell
    leftSidebar={<div>sessions</div>}
    main={<div>board</div>}
    drawer={hasDock ? <p>Terminal dock</p> : null}
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
});
