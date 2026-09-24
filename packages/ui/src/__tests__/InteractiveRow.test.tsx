// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InteractiveRow } from '../components/InteractiveRow';

afterEach(cleanup);

const renderRow = ({ onOpen, onInner }: { onOpen: () => void; onInner: () => void }) =>
  render(
    <InteractiveRow
      label="Open the comment"
      isSelected={false}
      onOpen={onOpen}
      dataAttributes={{ 'data-thread-id': 'thread-1' }}
    >
      <span>Cap the attempts.</span>
      <button type="button" onClick={onInner}>
        Show more
      </button>
      <a href="#commit">abc1234</a>
    </InteractiveRow>,
  );

describe('InteractiveRow', () => {
  it('exposes exactly one open control per row, carrying the data attributes', () => {
    renderRow({ onOpen: vi.fn(), onInner: vi.fn() });

    const open = screen.getByRole('button', { name: 'Open the comment' });
    expect(open.getAttribute('data-thread-id')).toBe('thread-1');
    expect(screen.queryAllByRole('button', { name: /open/i })).toHaveLength(1);
    expect(document.querySelector('[role="button"]')).toBeNull();
  });

  it('opens from the overlay and leaves inner controls to themselves', () => {
    const onOpen = vi.fn();
    const onInner = vi.fn();
    renderRow({ onOpen, onInner });

    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(onInner).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('link', { name: 'abc1234' }));
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Open the comment' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('marks the selected row with the shared neutral recipe and aria-current', () => {
    render(
      <InteractiveRow label="Open" isSelected onOpen={vi.fn()}>
        <span>row</span>
      </InteractiveRow>,
    );

    const open = screen.getByRole('button', { name: 'Open' });
    expect(open.getAttribute('aria-current')).toBe('true');
    expect(open.parentElement?.getAttribute('data-selected')).toBe('true');
    expect(open.parentElement?.className).toContain('data-[selected=true]:bg-selected');
  });
});
