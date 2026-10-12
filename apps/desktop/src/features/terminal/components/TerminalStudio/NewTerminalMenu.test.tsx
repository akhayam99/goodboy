// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NewTerminalMenu } from './NewTerminalMenu';

afterEach(cleanup);

describe('the New terminal button', () => {
  it('carries the plus glyph, not the compose pencil, and opens a terminal', () => {
    const onNew = vi.fn();
    render(<NewTerminalMenu targets={[]} onNew={onNew} onOpenAt={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'New terminal' });
    expect(button.querySelector('svg.lucide-plus')).not.toBeNull();
    expect(button.querySelector('svg.lucide-square-pen')).toBeNull();
    fireEvent.click(button);
    expect(onNew).toHaveBeenCalledOnce();
  });
});
