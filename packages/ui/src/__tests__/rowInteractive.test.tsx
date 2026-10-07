// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { FOCUS_RING } from '../focusRing';
import { InteractiveRow } from '../components/InteractiveRow';
import { SelectableRow } from '../components/SelectableRow';
import { ROW_HOVER, ROW_INTERACTIVE } from '../rowInteractive';

afterEach(cleanup);

const tokensOf = ({ value }: { readonly value: string }): ReadonlyArray<string> =>
  value.split(/\s+/).filter((token) => token !== '');

const classesOf = ({ elements }: { readonly elements: ReadonlyArray<Element | null> }) =>
  new Set(elements.flatMap((element) => Array.from(element?.classList ?? [])));

describe('ROW_INTERACTIVE', () => {
  it('is the hover layer, the pointer and the focus ring, nothing else', () => {
    expect(tokensOf({ value: ROW_INTERACTIVE })).toEqual([
      ...tokensOf({ value: ROW_HOVER }),
      ...tokensOf({ value: FOCUS_RING }),
    ]);
    expect(tokensOf({ value: ROW_HOVER })).toContain('hover:bg-hover');
    expect(tokensOf({ value: FOCUS_RING })).toContain('focus-visible:ring-focus-ring');
  });

  it('is on a SelectableRow, the one clickable element of the row', () => {
    render(
      <SelectableRow selected={false} onClick={() => undefined}>
        Providers
      </SelectableRow>,
    );
    const row = screen.getByRole('button', { name: 'Providers' });
    const classes = classesOf({ elements: [row] });

    expect(tokensOf({ value: ROW_INTERACTIVE }).every((token) => classes.has(token))).toBe(true);
  });

  it('is on an InteractiveRow split between its frame and its overlay button', () => {
    render(
      <InteractiveRow label="Open the comment" isSelected={false} onOpen={() => undefined}>
        <span>Cap the attempts.</span>
      </InteractiveRow>,
    );
    const open = screen.getByRole('button', { name: 'Open the comment' });
    const classes = classesOf({ elements: [open, open.parentElement] });

    expect(tokensOf({ value: ROW_INTERACTIVE }).every((token) => classes.has(token))).toBe(true);
  });

  it('keeps the hover layer off the overlay button so it never doubles', () => {
    render(
      <InteractiveRow label="Open the comment" isSelected={false} onOpen={() => undefined}>
        <span>Cap the attempts.</span>
      </InteractiveRow>,
    );
    const open = screen.getByRole('button', { name: 'Open the comment' });

    expect(open.classList.contains('hover:bg-hover')).toBe(false);
    expect(open.parentElement?.classList.contains('hover:bg-hover')).toBe(true);
  });
});
