// @vitest-environment happy-dom

import { lazy } from 'react';
import { Workflow } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
    closeLabel="close inbox"
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

    fireEvent.click(screen.getByRole('button', { name: 'close inbox' }));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onClose).toHaveBeenCalledOnce();
  });
});
