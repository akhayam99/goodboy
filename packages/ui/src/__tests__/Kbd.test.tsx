// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Kbd } from '../components/Kbd';
import { KbdPill } from '../components/KbdPill';

afterEach(cleanup);

const TODAYS_PILL_CLASSES = [
  'inline-flex',
  'h-5',
  'min-w-5',
  'items-center',
  'justify-center',
  'rounded-sm',
  'border',
  'border-border',
  'bg-muted',
  'px-1',
  'text-code',
  'text-muted-foreground',
];

const classesOf = ({ element }: { readonly element: Element | null }): ReadonlyArray<string> =>
  Array.from(element?.classList ?? []);

describe('Kbd', () => {
  it('is bare text by default: no box, no fill, no fixed height', () => {
    const { container } = render(<Kbd>⌘L</Kbd>);
    const kbd = container.querySelector('kbd');
    const classes = classesOf({ element: kbd });

    expect(kbd?.getAttribute('data-look')).toBe('inline');
    expect(classes).toEqual(['font-sans', 'text-meta', 'text-faint-foreground']);
    expect(classes.some((name) => name.startsWith('border'))).toBe(false);
    expect(classes.some((name) => name.startsWith('bg-'))).toBe(false);
    expect(classes.some((name) => /^(h|min-h|min-w)-/.test(name))).toBe(false);
  });

  it('keeps the boxed cap for a single key inside a button', () => {
    const { container } = render(<Kbd look="cap">A</Kbd>);
    const kbd = container.querySelector('kbd');

    expect(kbd?.getAttribute('data-look')).toBe('cap');
    expect(classesOf({ element: kbd })).toEqual(TODAYS_PILL_CLASSES);
  });

  it('lets the caller add a class and pass attributes through', () => {
    const { container } = render(
      <Kbd aria-hidden className="shrink-0">
        ⌘K
      </Kbd>,
    );
    const kbd = container.querySelector('kbd');

    expect(kbd?.getAttribute('aria-hidden')).toBe('true');
    expect(classesOf({ element: kbd })).toContain('shrink-0');
    expect(kbd?.textContent).toBe('⌘K');
  });
});

describe('KbdPill', () => {
  it('stays the cap look with the same props for its importers', () => {
    const { container } = render(<KbdPill aria-hidden>S</KbdPill>);
    const kbd = container.querySelector('kbd');

    expect(kbd?.getAttribute('data-look')).toBe('cap');
    expect(kbd?.getAttribute('aria-hidden')).toBe('true');
    expect(classesOf({ element: kbd })).toEqual(TODAYS_PILL_CLASSES);
  });
});
