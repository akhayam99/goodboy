// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Star } from 'lucide-react';
import { CardAction } from '../components/CardAction';

afterEach(cleanup);

describe('CardAction', () => {
  it('reveals on card hover and focus when reveal is set', () => {
    render(<CardAction icon={Star} label="Pin" reveal onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Pin' });

    expect(button.className).toContain('opacity-0');
    expect(button.className).toContain('group-hover/card:opacity-100');
    expect(button.className).toContain('group-focus-within/card:opacity-100');
  });

  it('stays opaque when reveal is not set', () => {
    render(<CardAction icon={Star} label="Pin" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Pin' }).className).not.toContain('opacity-0');
  });

  it('tints itself when highlighted', () => {
    render(<CardAction icon={Star} label="Pin" tone="success" highlighted onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Pin' }).className).toContain('success');
  });

  it('exposes pressed and expanded state', () => {
    render(<CardAction icon={Star} label="Pin" pressed expanded onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Pin' });

    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('stops click propagation to the surrounding card', () => {
    const onClick = vi.fn();
    const onCardClick = vi.fn();

    render(
      <div onClick={onCardClick}>
        <CardAction icon={Star} label="Pin" onClick={onClick} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pin' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
