// @vitest-environment happy-dom

import { lazy } from 'react';
import { Workflow } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PAGE_MEASURE, PaneShell } from '@goodboy/ui';
import type { StudioKind } from '../../../store';
import { STUDIO_META } from './studioMeta';
import { StudioShell } from '../../../shared/components/StudioShell';
import { StudioDetail } from '../../../shared/components/StudioShell/StudioDetail';
import { StudioTrail } from '../../../shared/components/StudioShell/StudioTrail';
import { StudioFrame } from './index';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type BodyProps = {
  readonly subtitle?: string;
  readonly isEscapeEnabled?: boolean;
};

const Body = ({ subtitle, isEscapeEnabled = true }: BodyProps) => (
  <StudioShell
    title="Tasks"
    closeLabel="Close tasks"
    {...(subtitle !== undefined && { subtitle })}
    isEscapeEnabled={isEscapeEnabled}
    headerAccessory={<button type="button">Refresh</button>}
    onClose={() => undefined}
  >
    {() => (
      <StudioDetail>
        <p>inbox body</p>
      </StudioDetail>
    )}
  </StudioShell>
);

const STUDIO_KINDS: ReadonlyArray<StudioKind> = [
  'settings',
  'guide',
  'addWorkspace',
  'workflow',
  'work',
  'inbox',
  'impact',
  'changelog',
  'notifications',
  'chat',
  'terminal',
  'browser',
  'monitoring',
];

const pressEscape = () => fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

describe('StudioFrame', () => {
  it('shows the skeleton of the studio on an opaque frame while the body loads', () => {
    const Pending = lazy(() => new Promise<never>(() => undefined));
    const { container } = render(
      <StudioFrame kind="workflow" onClose={() => undefined}>
        <Pending />
      </StudioFrame>,
    );

    const frame = container.querySelector('[data-studio-frame]');
    expect(frame?.className).toContain('bg-chrome');
    expect(screen.getByRole('status', { name: 'Loading Workflows' })).toBeDefined();
    expect(container.querySelector('[data-studio-skeleton="rows"]')).not.toBeNull();
    expect(container.querySelector('[data-studio-skeleton="cards"]')).toBeNull();
    expect(container.querySelector('[data-studio-band]')).toBeNull();
  });

  it('loads settings behind a rail', () => {
    const Pending = lazy(() => new Promise<never>(() => undefined));
    const { container } = render(
      <StudioFrame kind="settings" onClose={() => undefined}>
        <Pending />
      </StudioFrame>,
    );

    expect(screen.getByRole('status', { name: 'Loading Settings' })).toBeDefined();
    expect(container.querySelector('[data-studio-skeleton-rail]')).not.toBeNull();
    expect(container.querySelector('[data-studio-skeleton="rows"]')).not.toBeNull();
  });

  it('draws Settings in the page slot with a skeleton that keeps the band room beside its rail', () => {
    const Pending = lazy(() => new Promise<never>(() => undefined));
    const { container } = render(
      <StudioFrame kind="settings" placement="content" onClose={() => undefined}>
        <Pending />
      </StudioFrame>,
    );

    expect(container.querySelector('[data-studio-band]')).toBeNull();
    expect(container.querySelector('[data-studio-skeleton-rail]')).not.toBeNull();
    expect(container.querySelector('[data-studio-skeleton="rows"]')).not.toBeNull();
  });

  it('lists every studio kind once for the skeleton walk', () => {
    expect([...STUDIO_KINDS].sort()).toEqual(Object.keys(STUDIO_META).sort());
  });

  it.each(STUDIO_KINDS)(
    'loads %s on the skeleton of its own page, at the page header inset and measure',
    (kind) => {
      const Pending = lazy(() => new Promise<never>(() => undefined));
      const { container } = render(
        <StudioFrame kind={kind} placement="content" onClose={() => undefined}>
          <Pending />
        </StudioFrame>,
      );

      const meta = STUDIO_META[kind];
      const skeleton = container.querySelector<HTMLElement>('[data-page-skeleton]');
      expect(
        container.querySelector(`[data-studio-skeleton="${meta.skeleton.shape}"]`),
      ).not.toBeNull();
      expect(skeleton?.getAttribute('data-page-skeleton')).toBe(meta.page ?? '');
      const column = skeleton?.querySelector('[data-page-column]');
      expect(column?.getAttribute('data-width')).toBe(
        meta.page === null ? 'column' : PAGE_MEASURE[meta.page],
      );
      if (meta.page === null) {
        return;
      }
      const header = skeleton?.querySelector<HTMLElement>('[data-page-header]');
      expect(header?.getAttribute('data-page')).toBe(meta.page);
      const isUnderBand = meta.close === 'back';
      expect(header?.className.split(' ').includes('pt-2')).toBe(!isUnderBand);
    },
  );

  it('closes the Settings page on Escape', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <StudioFrame kind="settings" placement="content" onClose={onClose}>
        <Body />
      </StudioFrame>,
    );

    pressEscape();
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each(['inbox', 'chat', 'workflow', 'terminal', 'impact', 'monitoring'] as const)(
    'draws no band, no title and no Close around the %s door page',
    (kind) => {
      const { container } = render(
        <StudioFrame kind={kind} onClose={() => undefined}>
          <PaneShell title="Page title">
            <p>body</p>
          </PaneShell>
        </StudioFrame>,
      );

      expect(container.querySelector('[data-studio-band]')).toBeNull();
      expect(screen.queryByRole('button', { name: /^Close/ })).toBeNull();
      expect(screen.getAllByRole('heading')).toHaveLength(1);
      const header = container.querySelector('[data-slot="pane-header"]');
      expect(header?.hasAttribute('data-under-trail')).toBe(false);
    },
  );

  it.each(['notifications'] as const)(
    'draws no Close in the %s page header: the door or Escape leaves',
    (kind) => {
      const { container } = render(
        <StudioFrame kind={kind} onClose={() => undefined}>
          <PaneShell title="Page title" actions={<button type="button">Refresh</button>}>
            <p>body</p>
          </PaneShell>
        </StudioFrame>,
      );

      expect(container.querySelector('[data-studio-band]')).toBeNull();
      expect(screen.queryByRole('button', { name: /^Close/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Back to app/ })).toBeNull();
    },
  );

  it('gives addWorkspace, which replaces the column, Back to app with the Esc chip', () => {
    render(
      <StudioFrame kind="addWorkspace" onClose={() => undefined}>
        <PaneShell title="New workspace">
          <p>body</p>
        </PaneShell>
      </StudioFrame>,
    );

    const back = screen.getByRole('button', { name: /^Back to app/ });
    expect(back.textContent).toContain('Esc');
    expect(screen.queryByRole('button', { name: /^Close/ })).toBeNull();
  });

  it.each(STUDIO_KINDS)('never draws a Close button around %s', (kind) => {
    render(
      <StudioFrame kind={kind} onClose={() => undefined}>
        <PaneShell title="Page title">
          <p>body</p>
        </PaneShell>
      </StudioFrame>,
    );

    expect(screen.queryByRole('button', { name: /^Close/ })).toBeNull();
  });

  it('lets a studio body carry its own trail into the band, in place of the root', () => {
    const onBack = vi.fn();
    render(
      <StudioFrame kind="workflow" onClose={() => undefined}>
        <StudioTrail
          segments={[
            { id: 'workflows', label: 'Workflows', icon: Workflow, onSelect: onBack },
            { id: 'workflow', label: 'Ship a fix', icon: Workflow },
          ]}
        />
      </StudioFrame>,
    );

    const band = screen.getByRole('banner', { name: 'Workflows' });
    expect(within(band).getAllByRole('navigation', { name: 'Breadcrumb' })).toHaveLength(1);
    expect(within(band).getByText('Ship a fix').getAttribute('aria-current')).toBe('page');
    fireEvent.click(within(band).getByRole('button', { name: 'Workflows' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('draws a band only for what the body hands it, never a title or a subtitle', () => {
    const { container } = render(
      <StudioFrame kind="inbox" onClose={() => undefined}>
        <Body subtitle="3 items" />
      </StudioFrame>,
    );

    expect(container.querySelectorAll('header')).toHaveLength(1);
    const band = screen.getByRole('banner', { name: 'Tasks' });
    expect(within(band).getByRole('button', { name: 'Refresh' })).toBeDefined();
    expect(within(band).queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
    expect(within(band).queryByText('Tasks')).toBeNull();
    expect(screen.queryByText('3 items')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close tasks' })).toBeNull();
    expect(screen.getByText('inbox body')).toBeDefined();
  });

  it('keeps the same frame node when the studio changes', () => {
    const { container, rerender } = render(
      <StudioFrame kind="inbox" onClose={() => undefined}>
        <Body />
      </StudioFrame>,
    );
    const frame = container.querySelector('[data-studio-frame]');

    rerender(
      <StudioFrame kind="notifications" onClose={() => undefined}>
        <StudioDetail>
          <p>notifications body</p>
        </StudioDetail>
      </StudioFrame>,
    );

    expect(container.querySelector('[data-studio-frame]')).toBe(frame);
    expect(screen.getByText('notifications body')).toBeDefined();
    expect(screen.queryByText('inbox body')).toBeNull();
  });

  it('closes on Escape through the escape stack after the exit motion', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <StudioFrame kind="inbox" onClose={onClose}>
        <Body />
      </StudioFrame>,
    );

    pressEscape();
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('leaves Escape to the body while the body holds it', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <StudioFrame kind="inbox" onClose={onClose}>
        <Body isEscapeEnabled={false} />
      </StudioFrame>,
    );

    pressEscape();
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes from the band button', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <StudioFrame kind="addWorkspace" onClose={onClose}>
        <p>new workspace body</p>
      </StudioFrame>,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Back to app/ }));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('StudioFrame grid', () => {
  const columnOf = (node: HTMLElement) => node.closest('[data-page-column]') as HTMLElement | null;

  it.each(['addWorkspace'] as const)(
    'draws the %s band inside the page column, like the title under it',
    (kind) => {
      render(
        <StudioFrame kind={kind} onClose={() => undefined}>
          <PaneShell title="Studio title">
            <p>body</p>
          </PaneShell>
        </StudioFrame>,
      );

      const band = screen.getByRole('banner');
      const bandColumn = band.querySelector('[data-page-column]') as HTMLElement;
      expect(bandColumn.getAttribute('data-width')).toBe('column');
      expect(columnOf(screen.getByRole('heading', { level: 1 }))?.getAttribute('data-width')).toBe(
        'column',
      );
    },
  );

  it("gives What's new, a tab of Help, the same Back to app band and no Close", () => {
    const { container } = render(
      <StudioFrame kind="changelog" onClose={() => undefined}>
        <div className="flex">
          <aside aria-label="Rail" />
          <StudioDetail>
            <PaneShell title="Goodboy 0.27.2">
              <p>body</p>
            </PaneShell>
          </StudioDetail>
        </div>
      </StudioFrame>,
    );

    expect(
      container
        .querySelector('[data-studio-band]')
        ?.contains(screen.getByRole('button', { name: /^Back to app/ })),
    ).toBe(true);
    expect(screen.queryByRole('button', { name: /^Close/ })).toBeNull();
  });

  it('puts Back to app in the band of the guide detail, beside the rail', () => {
    const { container } = render(
      <StudioFrame kind="guide" onClose={() => undefined}>
        <div className="flex">
          <aside aria-label="Rail" />
          <StudioDetail>
            <PaneShell title="What is Goodboy">
              <p>body</p>
            </PaneShell>
          </StudioDetail>
        </div>
      </StudioFrame>,
    );

    const band = screen.getByRole('banner');
    const back = screen.getByRole('button', { name: /^Back to app/ });
    expect(band.contains(back)).toBe(true);
    expect(back.textContent).toContain('Esc');
    expect(container.querySelector('[data-studio-detail]')?.firstElementChild).toBe(band);
    expect(screen.queryByRole('button', { name: /^Close/ })).toBeNull();
  });

  it('keeps Back to app at the left edge of the band column, with no crumb of its own', () => {
    render(
      <StudioFrame kind="addWorkspace" onClose={() => undefined}>
        <p>body</p>
      </StudioFrame>,
    );

    const column = screen.getByRole('banner').querySelector('[data-page-column]') as HTMLElement;
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
    expect(column.firstElementChild).toBe(screen.getByRole('button', { name: /^Back to app/ }));
  });

  it('sits the studio title right under the band, with no extra top inset', () => {
    const { container } = render(
      <StudioFrame kind="addWorkspace" onClose={() => undefined}>
        <PaneShell title="New workspace">
          <p>body</p>
        </PaneShell>
      </StudioFrame>,
    );

    const header = container.querySelector('[data-slot="pane-header"]') as HTMLElement;
    expect(header.hasAttribute('data-under-trail')).toBe(true);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps the top inset of a frame that draws no band', () => {
    const { container } = render(
      <StudioFrame kind="impact" placement="content" onClose={() => undefined}>
        <PaneShell title="Impact">
          <p>body</p>
        </PaneShell>
      </StudioFrame>,
    );

    const header = container.querySelector('[data-slot="pane-header"]') as HTMLElement;
    expect(header.hasAttribute('data-under-trail')).toBe(false);
  });
});
