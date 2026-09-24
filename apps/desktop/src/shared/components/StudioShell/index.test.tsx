// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Settings } from 'lucide-react';
import { StudioShell } from './index';

afterEach(cleanup);

const defaults = {
  icon: Settings,
  title: 'Test Studio',
  subtitle: 'acme',
  closeLabel: 'close test studio',
  onClose: vi.fn(),
};

describe('StudioShell variant rendering', () => {
  it('defaults to fullscreen, which fills the app shell studio slot', () => {
    const { container } = render(<StudioShell {...defaults}>{() => <p>body</p>}</StudioShell>);
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('h-full');
    expect(shell.className).not.toContain('fixed');
    expect(shell.className).not.toContain('top-9');
    expect(shell.hasAttribute('data-studio-overlay')).toBe(true);
  });

  it('variant="viewport" covers the window, for the launcher where no shell exists', () => {
    const { container } = render(
      <StudioShell {...defaults} variant="viewport">
        {() => <p>body</p>}
      </StudioShell>,
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('fixed');
    expect(shell.className).toContain('inset-0');
    expect(shell.className).toContain('z-studio');
  });

  it('variant="slot" applies relative positioning, no fixed/z-studio', () => {
    const { container } = render(
      <StudioShell {...defaults} variant="slot">
        {() => <p>body</p>}
      </StudioShell>,
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('relative');
    expect(shell.className).not.toContain('fixed');
    expect(shell.className).not.toContain('z-studio');
  });
});

describe('StudioShell header', () => {
  it('renders the title and its subtitle', () => {
    render(<StudioShell {...defaults}>{() => <p>body</p>}</StudioShell>);
    expect(screen.getByText('Test Studio')).toBeDefined();
    expect(screen.getByText('acme')).toBeDefined();
  });

  it('renders the header icon bare', () => {
    render(<StudioShell {...defaults}>{() => <p>body</p>}</StudioShell>);
    const header = screen.getByText('Test Studio').closest('header');
    const icon = header?.querySelector('svg.lucide-settings');
    expect(icon?.getAttribute('width')).toBe('18');
    expect(icon?.parentElement).toBe(header);
  });

  it('renders close button with correct aria-label', () => {
    render(<StudioShell {...defaults}>{() => <p>body</p>}</StudioShell>);
    expect(screen.getByRole('button', { name: 'close test studio' })).toBeDefined();
  });
});

describe('StudioShell close behavior', () => {
  it('clicking Done triggers onClose after animation delay', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <StudioShell {...defaults} onClose={onClose}>
        {() => <p>body</p>}
      </StudioShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'close test studio' }));
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('Escape triggers onClose after animation delay', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <StudioShell {...defaults} onClose={onClose}>
        {() => <p>body</p>}
      </StudioShell>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('passes requestClose to children render prop', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <StudioShell {...defaults} onClose={onClose}>
        {(requestClose) => (
          <button type="button" onClick={requestClose}>
            inner close
          </button>
        )}
      </StudioShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'inner close' }));
    vi.advanceTimersByTime(300);
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

describe('StudioShell animation classes', () => {
  it('applies studio-in animation on mount', () => {
    const { container } = render(<StudioShell {...defaults}>{() => <p>body</p>}</StudioShell>);
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('animate-studio-in');
    expect(shell.className).not.toContain('animate-studio-out');
  });

  it('applies studio-out animation when closing', () => {
    const { container } = render(<StudioShell {...defaults}>{() => <p>body</p>}</StudioShell>);
    fireEvent.click(screen.getByRole('button', { name: 'close test studio' }));
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('animate-studio-out');
    expect(shell.className).not.toContain('animate-studio-in');
  });
});

describe('StudioShell subtitle', () => {
  it('renders no subtitle line when none is given', () => {
    render(
      <StudioShell icon={Settings} title="Changelog" closeLabel="close" onClose={() => undefined}>
        {() => <p>body</p>}
      </StudioShell>,
    );
    const header = screen.getByRole('banner', { name: 'Changelog' });
    expect(header.textContent?.replace(/\s+/g, '')).toBe('ChangelogDone');
  });
});
