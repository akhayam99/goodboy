// @vitest-environment happy-dom

import { lazy } from 'react';
import { Workflow } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PaneShell } from '@goodboy/ui';
import { StudioShell } from '../../../shared/components/StudioShell';
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
    title="Inbox"
    closeLabel="Close inbox"
    {...(subtitle !== undefined && { subtitle })}
    isEscapeEnabled={isEscapeEnabled}
    headerAccessory={<button type="button">Refresh</button>}
    onClose={() => undefined}
  >
    {() => <p>inbox body</p>}
  </StudioShell>
);

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
    expect(container.querySelector('[data-studio-skeleton="grid"]')).not.toBeNull();
    expect(screen.getByRole('banner', { name: 'Workflows' })).toBeDefined();
  });

  it('loads settings behind a rail', () => {
    const Pending = lazy(() => new Promise<never>(() => undefined));
    const { container } = render(
      <StudioFrame kind="settings" onClose={() => undefined}>
        <Pending />
      </StudioFrame>,
    );

    expect(screen.getByRole('status', { name: 'Loading Settings' })).toBeDefined();
    expect(container.querySelector('[data-studio-skeleton="rail"]')).not.toBeNull();
    expect(container.querySelector('[data-studio-skeleton="grid"]')).toBeNull();
  });

  it('draws no band for a frame that is only a page, and its skeleton has no rail', () => {
    const Pending = lazy(() => new Promise<never>(() => undefined));
    const { container } = render(
      <StudioFrame kind="settings" placement="content" hasBand={false} onClose={() => undefined}>
        <Pending />
      </StudioFrame>,
    );

    expect(screen.queryByRole('banner')).toBeNull();
    expect(container.querySelector('[data-studio-band]')).toBeNull();
    expect(container.querySelector('[data-studio-skeleton="rail"]')).toBeNull();
    expect(container.querySelector('[data-studio-skeleton="list"]')).not.toBeNull();
  });

  it('still closes a bandless frame on Escape', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <StudioFrame kind="settings" placement="content" hasBand={false} onClose={onClose}>
        <Body />
      </StudioFrame>,
    );

    pressEscape();
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('names the studio with the trail primitive in its band', () => {
    render(
      <StudioFrame kind="inbox" onClose={() => undefined}>
        <Body />
      </StudioFrame>,
    );

    const band = screen.getByRole('banner', { name: 'Inbox' });
    const trail = within(band).getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(trail).getByText('Inbox').getAttribute('aria-current')).toBe('page');
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

  it('draws the band once and lets the body fill it', () => {
    const { container } = render(
      <StudioFrame kind="inbox" onClose={() => undefined}>
        <Body subtitle="3 items" />
      </StudioFrame>,
    );

    expect(container.querySelectorAll('header')).toHaveLength(1);
    expect(screen.getByText('3 items')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDefined();
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
        <p>notifications body</p>
      </StudioFrame>,
    );

    expect(container.querySelector('[data-studio-frame]')).toBe(frame);
    expect(screen.getByRole('banner', { name: 'Notifications' })).toBeDefined();
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
      <StudioFrame kind="inbox" onClose={onClose}>
        <Body />
      </StudioFrame>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close inbox' }));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('StudioFrame grid', () => {
  const columnOf = (node: HTMLElement) => node.closest('[data-page-column]') as HTMLElement | null;

  it.each(['inbox', 'workflow', 'impact', 'guide', 'changelog', 'notifications'] as const)(
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

  it('lines the chat band up with the 24px gutter beside its rail', () => {
    render(
      <StudioFrame kind="chat" onClose={() => undefined}>
        <p>chat body</p>
      </StudioFrame>,
    );

    const band = screen.getByRole('banner');
    expect(
      (band.querySelector('[data-page-column]') as HTMLElement).getAttribute('data-width'),
    ).toBe('full');
  });

  it('keeps Close at the right edge of the same column as the crumb', () => {
    render(
      <StudioFrame kind="impact" onClose={() => undefined}>
        <p>body</p>
      </StudioFrame>,
    );

    const column = screen.getByRole('banner').querySelector('[data-page-column]') as HTMLElement;
    expect(column.contains(screen.getByRole('navigation', { name: 'Breadcrumb' }))).toBe(true);
    expect(column.contains(screen.getByRole('button', { name: 'Close impact' }))).toBe(true);
  });

  it('sits the studio title right under the band, with no extra top inset', () => {
    const { container } = render(
      <StudioFrame kind="workflow" onClose={() => undefined}>
        <PaneShell title="Workflows">
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
      <StudioFrame kind="settings" placement="content" hasBand={false} onClose={() => undefined}>
        <PaneShell title="Settings">
          <p>body</p>
        </PaneShell>
      </StudioFrame>,
    );

    const header = container.querySelector('[data-slot="pane-header"]') as HTMLElement;
    expect(header.hasAttribute('data-under-trail')).toBe(false);
  });
});
