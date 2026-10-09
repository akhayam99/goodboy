// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  BUTTON_SIZE_CLASSES,
  BUTTON_VARIANT_CLASSES,
  Button,
  type ButtonSize,
  type ButtonVariant,
} from '../components/Button';
import { FOCUS_RING } from '../focusRing';

const HEIGHT_BY_SIZE = { xs: 'h-6', sm: 'h-7', md: 'h-8' } as const satisfies Record<
  ButtonSize,
  string
>;

const VARIANTS = [
  'primary',
  'secondary',
  'ghost',
  'danger',
  'quiet',
  'ghost-danger',
] as const satisfies ReadonlyArray<ButtonVariant>;

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

  it('draws xs, sm and md at 24, 28 and 32 and names its size', () => {
    render(
      <>
        <Button size="xs">Extra</Button>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
      </>,
    );

    for (const [label, size] of [
      ['Extra', 'xs'],
      ['Small', 'sm'],
      ['Medium', 'md'],
    ] as const) {
      const button = screen.getByRole('button', { name: label });
      expect(button.getAttribute('data-size')).toBe(size);
      expect(button.className.split(' ')).toContain(HEIGHT_BY_SIZE[size]);
    }
  });

  it('defaults to sm so an unsized button sits at 28', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });

    expect(button.getAttribute('data-size')).toBe('sm');
    expect(button.className.split(' ')).toContain('h-7');
    expect(button.className.split(' ')).not.toContain('h-8');
  });

  it('spaces the icon by 4 at xs and by 8 above it', () => {
    expect(BUTTON_SIZE_CLASSES.xs.split(' ')).toContain('gap-1');
    expect(BUTTON_SIZE_CLASSES.sm.split(' ')).toContain('gap-2');
    expect(BUTTON_SIZE_CLASSES.md.split(' ')).toContain('gap-2');
  });

  it('offers exactly the ladder of variants, with quiet and ghost danger in it', () => {
    expect(Object.keys(BUTTON_VARIANT_CLASSES).sort()).toEqual([...VARIANTS].sort());
    expect(BUTTON_VARIANT_CLASSES.quiet).toContain('text-muted-foreground');
    expect(BUTTON_VARIANT_CLASSES['ghost-danger']).toContain('text-danger');
    expect(BUTTON_VARIANT_CLASSES['ghost-danger']).not.toContain('bg-danger ');
  });

  it('keeps every variant as an enabled button', () => {
    render(
      <>
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </>,
    );

    for (const variant of VARIANTS) {
      expect(screen.getByRole('button', { name: variant }).hasAttribute('disabled')).toBe(false);
    }
  });

  it('shows a disabled button as the fill with the disabled label, never as half opacity', () => {
    render(
      <>
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant} disabled>
            {variant}
          </Button>
        ))}
      </>,
    );

    for (const variant of VARIANTS) {
      const classes = screen.getByRole('button', { name: variant }).className;
      expect(classes).toContain('disabled:text-disabled-foreground');
      expect(classes).not.toContain('opacity-50');
    }
    expect(BUTTON_VARIANT_CLASSES.primary).toContain('disabled:bg-fill');
  });
});
