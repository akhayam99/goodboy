// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Button } from '../components/Button';

describe('Button', () => {
  afterEach(cleanup);

  it('shows a pulsing status dot while busy, never a spinner', () => {
    const { container } = render(<Button isBusy>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });

    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('.motion-safe\\:animate-pulse')).not.toBeNull();
  });

  it('keeps the busy label instead of the children when given one', () => {
    render(
      <Button isBusy busyLabel="Saving">
        Save
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Saving' })).toBeDefined();
  });

  it('disables the button while busy', () => {
    render(<Button isBusy>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
  });
});
