// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Kbd } from '../components/Kbd';
import { KbdPill } from '../components/KbdPill';
import { KeyHint } from '../components/KeyHint';
import { isChordHint } from '../components/Kbd';

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

  it('marks an on-tone key and leaves an ordinary one unmarked', () => {
    const { container } = render(
      <>
        <Kbd isOnTone>F</Kbd>
        <Kbd>G</Kbd>
      </>,
    );
    const [onTone = null, plain = null] = [...container.querySelectorAll('kbd')];

    expect(onTone?.getAttribute('data-on-tone')).toBe('true');
    expect(classesOf({ element: onTone })).toContain('text-on-tone');
    expect(plain?.hasAttribute('data-on-tone')).toBe(false);
    expect(classesOf({ element: plain })).not.toContain('text-on-tone');
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

describe('on a filled button', () => {
  it('takes the label colour from the tone token, never an opacity rule', () => {
    const { container } = render(
      <>
        <Kbd look="cap" isOnTone>
          F
        </Kbd>
        <Kbd isOnTone>⌘↵</Kbd>
      </>,
    );
    const [cap, chord] = Array.from(container.querySelectorAll('kbd'));

    expect(classesOf({ element: cap ?? null })).toEqual(
      expect.arrayContaining(['text-on-tone', 'border-on-tone/30', 'bg-on-tone/15']),
    );
    expect(classesOf({ element: chord ?? null })).toContain('text-on-tone');
    expect(classesOf({ element: chord ?? null }).some((name) => name.includes('opacity'))).toBe(
      false,
    );
  });
});

describe('KeyHint', () => {
  it('tells a chord from a single key', () => {
    expect(isChordHint('⌘↵')).toBe(true);
    expect(isChordHint('Ctrl+Enter')).toBe(true);
    expect(isChordHint('F')).toBe(false);
    expect(isChordHint('Esc')).toBe(false);
  });

  it('draws a chord bare and a single key as the small cap', () => {
    const { container } = render(
      <>
        <KeyHint keys="⌘↵" />
        <KeyHint keys="F" />
      </>,
    );
    const [chord, key] = Array.from(container.querySelectorAll('kbd'));

    expect(chord?.getAttribute('data-look')).toBe('inline');
    expect(key?.getAttribute('data-look')).toBe('cap');
    expect(key?.getAttribute('aria-hidden')).toBe('true');
  });
});
