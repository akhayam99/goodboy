// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Layers } from 'lucide-react';
import { SplitButton } from '../components/SplitButton';
import type { OverflowMenuItem } from '../components/MenuItems';

afterEach(cleanup);

type RenderParams = {
  readonly onPrimary?: () => void;
  readonly onItem?: () => void;
};

const renderSplit = ({ onPrimary = vi.fn(), onItem = vi.fn() }: RenderParams = {}) => {
  const items: ReadonlyArray<OverflowMenuItem> = [
    {
      kind: 'item',
      key: 'batch',
      label: 'Batch',
      description: 'Several at once',
      icon: Layers,
      tone: 'info',
      onClick: onItem,
    },
  ];
  render(
    <SplitButton
      menuLabel="More ways"
      items={items}
      primary={({ className }) => (
        <button type="button" className={className} onClick={onPrimary}>
          Start
        </button>
      )}
    />,
  );
};

describe('SplitButton', () => {
  it('squares the facing corners of both halves', () => {
    renderSplit();

    expect(screen.getByRole('button', { name: 'Start' }).className).toContain('rounded-r-none');
    expect(screen.getByRole('button', { name: 'More ways' }).className).toContain('rounded-l-none');
  });

  it('leaves the primary half to its owner and keeps the menu closed', () => {
    const onPrimary = vi.fn();
    renderSplit({ onPrimary });

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(onPrimary).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens a menu whose items carry a description, and closes it on pick', () => {
    const onItem = vi.fn();
    renderSplit({ onItem });

    const trigger = screen.getByRole('button', { name: 'More ways' });
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const item = screen.getByRole('menuitem', { name: /Batch/ });
    expect(item.textContent).toBe('BatchSeveral at once');
    expect(item.querySelector('svg')?.getAttribute('class')).toContain('text-info');

    fireEvent.click(item);

    expect(onItem).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
