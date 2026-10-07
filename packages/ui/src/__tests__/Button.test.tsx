// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Button } from '../components/Button';
import { FOCUS_RING } from '../focusRing';

describe('Button', () => {
  afterEach(cleanup);

  it('shows a pulsing status dot while busy, never a spinner', () => {
    const { container } = render(<Button isBusy>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });

    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('.motion-safe\\:animate-soft-pulse')).not.toBeNull();
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

  it('uses the shared focus treatment', () => {
    render(<Button>Save</Button>);
    const classes = screen.getByRole('button', { name: 'Save' }).className.split(' ');
    expect(classes).toEqual(expect.arrayContaining(FOCUS_RING.split(' ')));
  });

  it('has an extra small size for a ghost action inside a row', () => {
    render(
      <Button variant="ghost" size="xs">
        Open
      </Button>,
    );
    const classes = screen.getByRole('button', { name: 'Open' }).className.split(' ');

    expect(classes).toContain('h-6');
    expect(classes).not.toContain('h-7');
  });

  it('draws sm at 28px and names its size for a header row to check', () => {
    render(<Button size="sm">Create PR</Button>);
    const button = screen.getByRole('button', { name: 'Create PR' });

    expect(button.getAttribute('data-size')).toBe('sm');
    expect(button.className.split(' ')).toContain('h-7');
  });

  it('keeps every emphasis as an enabled button', () => {
    render(
      <>
        <Button variant="danger">Solid</Button>
        <Button variant="danger" emphasis="outline">
          Outline
        </Button>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Solid' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Outline' }).hasAttribute('disabled')).toBe(false);
  });

  it('renders the supported semantic actions as buttons', () => {
    render(
      <>
        <Button variant="info">Info</Button>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Info' })).toBeDefined();
  });
});
