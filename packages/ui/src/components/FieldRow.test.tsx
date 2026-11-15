// @vitest-environment happy-dom

import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Band } from './Band';
import { FieldRow } from './FieldRow';

const rowOf = (label: string): HTMLElement => {
  const row = screen.getByText(label).closest('[data-row]');
  if (!(row instanceof HTMLElement)) {
    throw new Error(`no row for ${label}`);
  }
  return row;
};

const shapeOf = (row: HTMLElement) => ({
  parts: row.children.length,
  labelLines: row.children[0]?.children.length,
  controls: row.children[1]?.children.length,
});

const Rows = () => (
  <Band inset="content">
    <div data-row="">
      <FieldRow
        label="Branch prefix"
        help="Every new session branch starts with this."
        marker={<span role="img" aria-label="Changed from default" />}
        menu={<button type="button">Branch prefix options</button>}
      >
        <span>
          <input aria-label="Branch prefix" />
          <span>/&lt;slug&gt;</span>
        </span>
      </FieldRow>
    </div>
    <div data-row="">
      <FieldRow label="Attribution line" help="Signs every comment Goodboy posts.">
        <button type="button">On</button>
      </FieldRow>
    </div>
  </Band>
);

describe('FieldRow', () => {
  afterEach(cleanup);

  it('keeps the shape of a plain row when it carries a marker and a menu', () => {
    render(<Rows />);

    const marked = rowOf('Branch prefix').firstElementChild;
    const plain = rowOf('Attribution line').firstElementChild;
    if (!(marked instanceof HTMLElement) || !(plain instanceof HTMLElement)) {
      throw new Error('rows not rendered');
    }

    expect(shapeOf(marked)).toEqual(shapeOf(plain));
    expect(shapeOf(marked)).toEqual({ parts: 2, labelLines: 2, controls: 1 });
  });

  it('puts the marker on the label line and the menu next to the control', () => {
    render(<Rows />);

    const marker = screen.getByRole('img', { name: 'Changed from default' });
    const menu = screen.getByRole('button', { name: 'Branch prefix options' });

    expect(marker.parentElement?.textContent).toBe('Branch prefix');
    expect(menu.parentElement?.contains(screen.getByLabelText('Branch prefix'))).toBe(true);
  });

  it('puts the anchor and the ref on the row itself, so the band rhythm still sees it', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Band inset="content" label="Naming">
        <FieldRow label="Theme" anchor="theme" ref={ref}>
          <input aria-label="Theme" />
        </FieldRow>
      </Band>,
    );

    expect(ref.current?.dataset.anchor).toBe('theme');
    expect(ref.current?.contains(screen.getByText('Theme'))).toBe(true);
    expect(ref.current?.dataset.highlighted).toBeUndefined();
  });

  it('lights a highlighted row with the selected surface', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <FieldRow label="Theme" anchor="theme" ref={ref} isHighlighted>
        <input aria-label="Theme" />
      </FieldRow>,
    );

    expect(ref.current?.dataset.highlighted).toBe('');
    expect(ref.current?.className).toContain('bg-selected');
  });
});
