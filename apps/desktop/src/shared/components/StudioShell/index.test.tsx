// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Settings } from 'lucide-react';
import { StudioShell } from './index';

afterEach(cleanup);

const defaults = {
  icon: Settings,
  title: 'Test Studio',
  workspaceName: 'acme',
  closeLabel: 'close test studio',
  onClose: vi.fn(),
};

describe('StudioShell variant rendering', () => {
  it('defaults to fullscreen variant (fixed inset-0 z-50)', () => {
    const { container } = render(<StudioShell {...defaults}>{() => <p>body</p>}</StudioShell>);
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('fixed');
    expect(shell.className).toContain('inset-0');
    expect(shell.className).toContain('z-50');
  });

  it('variant="fullscreen" applies fixed positioning', () => {
    const { container } = render(
      <StudioShell {...defaults} variant="fullscreen">
        {() => <p>body</p>}
      </StudioShell>,
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('fixed');
    expect(shell.className).toContain('z-50');
  });

  it('variant="slot" applies relative positioning, no fixed/z-50', () => {
    const { container } = render(
      <StudioShell {...defaults} variant="slot">
        {() => <p>body</p>}
      </StudioShell>,
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('relative');
    expect(shell.className).not.toContain('fixed');
    expect(shell.className).not.toContain('z-50');
  });
});

describe('StudioShell header', () => {
  it('renders title and workspace name', () => {
    render(<StudioShell {...defaults}>{() => <p>body</p>}</StudioShell>);
    expect(screen.getByText('Test Studio')).toBeDefined();
    expect(screen.getByText('acme')).toBeDefined();
  });

  it('renders the beta badge', () => {
    render(<StudioShell {...defaults}>{() => <p>body</p>}</StudioShell>);
    expect(screen.getByText('beta')).toBeDefined();
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
