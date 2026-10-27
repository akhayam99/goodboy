// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Star } from 'lucide-react';
import { CardAction } from '../components/CardAction';

afterEach(cleanup);

describe('CardAction', () => {
  it('shows a disabled action with the disabled label colour in place', () => {
    render(<CardAction icon={Star} label="Pin" disabled onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Pin' });

    expect(button.className).toContain('text-disabled-foreground');
    expect(button.className).not.toContain('opacity-40');
    expect(button.className).not.toContain('opacity-0');
  });

  it('stays visible at rest', () => {
    render(<CardAction icon={Star} label="Pin" onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Pin' }).className).not.toContain('opacity-0');
  });

  it('tints itself when highlighted', () => {
    render(<CardAction icon={Star} label="Pin" tone="success" highlighted onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Pin' });
    expect(button.className).toContain('success');
    expect(button.hasAttribute('data-highlighted')).toBe(true);
  });

  it('stays neutral at rest and takes its tone only on hover unless highlighted', () => {
    render(<CardAction icon={Star} label="Pin" tone="success" onClick={vi.fn()} />);
    const { className } = screen.getByRole('button', { name: 'Pin' });
    expect(className).toContain('text-muted-foreground');
    expect(className).toContain('hover:text-success');
    expect(className).toContain('hover:bg-success/5');
    expect(className).not.toMatch(/(^| )bg-success/);
    expect(className).not.toMatch(/(^| )text-success/);
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
