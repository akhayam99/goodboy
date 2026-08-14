// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RefreshCw } from 'lucide-react';
import { IconButton } from '../components/IconButton';

describe('IconButton', () => {
  afterEach(cleanup);

  it('names itself for assistive tech and for the pointer', () => {
    render(<IconButton icon={RefreshCw} label="Refresh issues" />);
    const button = screen.getByRole('button', { name: 'Refresh issues' });
    expect(button.getAttribute('title')).toBe('Refresh issues');
  });

  it('reports the action back to the caller', () => {
    const onClick = vi.fn();
    render(<IconButton icon={RefreshCw} label="Refresh issues" onClick={onClick} />);
    screen.getByRole('button', { name: 'Refresh issues' }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('refuses the action while disabled', () => {
    const onClick = vi.fn();
    render(<IconButton icon={RefreshCw} label="Refresh issues" disabled onClick={onClick} />);
    screen.getByRole('button', { name: 'Refresh issues' }).click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('tints itself when the action carries a tone', () => {
    render(<IconButton icon={RefreshCw} label="Delete plan" tone="danger" />);
    const classes = screen.getByRole('button', { name: 'Delete plan' }).className;
    expect(classes).toContain('text-danger');
    expect(classes).toContain('border-danger/20');
    expect(classes).toContain('hover:border-danger/40');
  });

  it('stays muted at the default tone', () => {
    render(<IconButton icon={RefreshCw} label="Refresh issues" />);
    const classes = screen.getByRole('button', { name: 'Refresh issues' }).className;
    expect(classes).toContain('text-muted-foreground');
    expect(classes).not.toContain('text-danger');
  });
});
