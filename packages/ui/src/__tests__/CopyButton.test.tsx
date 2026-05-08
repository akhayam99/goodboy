// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { CopyButton } from '../components/CopyButton';

afterEach(cleanup);

function mockClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    writable: true,
    configurable: true,
  });
}

async function flushMicrotasks() {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe('CopyButton', () => {
  it('renders with default copy label', () => {
    render(<CopyButton value="hello" />);
    expect(screen.getByRole('button', { name: 'copy text' })).toBeDefined();
    expect(screen.getByRole('button').textContent).toBe('copy');
  });

  it('renders with custom label', () => {
    render(<CopyButton value="hello" label="branch" />);
    expect(screen.getByRole('button', { name: 'copy branch' })).toBeDefined();
  });

  it('shows copied state then resets', async () => {
    vi.useFakeTimers();
    mockClipboard(vi.fn().mockResolvedValue(undefined));

    render(<CopyButton value="abc" label="branch" />);
    fireEvent.click(screen.getByRole('button'));

    await flushMicrotasks();
    expect(screen.getByRole('button').textContent).toBe('copied: branch');

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByRole('button').textContent).toBe('copy');
    vi.useRealTimers();
  });

  it('falls back to textarea hack when clipboard API throws', async () => {
    vi.useFakeTimers();
    mockClipboard(vi.fn().mockRejectedValue(new Error('denied')));

    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      writable: true,
      configurable: true,
    });

    render(<CopyButton value="fallback-val" label="path" />);
    fireEvent.click(screen.getByRole('button'));

    await flushMicrotasks();

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(screen.getByRole('button').textContent).toBe('copied: path');
    vi.useRealTimers();
  });

  it('shows error state when both clipboard methods fail', async () => {
    vi.useFakeTimers();
    mockClipboard(vi.fn().mockRejectedValue(new Error('denied')));

    Object.defineProperty(document, 'execCommand', {
      value: vi.fn().mockImplementation(() => {
        throw new Error('execCommand failed');
      }),
      writable: true,
      configurable: true,
    });

    render(<CopyButton value="x" label="id" />);
    fireEvent.click(screen.getByRole('button'));

    await flushMicrotasks();
    expect(screen.getByRole('button').textContent).toBe('copy failed');
    vi.useRealTimers();
  });
});
