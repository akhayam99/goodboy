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
});
