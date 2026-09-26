// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  Band,
  BandRow,
  BandStack,
  STRIPED_BLOCK_LIST,
  STRIPED_LIST,
  STRIPED_ROW,
  STRIPED_TABLE,
} from './index';

afterEach(cleanup);

const bandOf = (text: string): HTMLElement => {
  const band = screen.getByText(text).closest('[data-band]');
  if (!(band instanceof HTMLElement)) {
    throw new Error('the row must sit inside a band');
  }
  return band;
};

describe('Band', () => {
  it('holds its section label and its body in one named section', () => {
    render(
      <Band label="Outcome" ariaLabel="Outcome">
        shipped it
      </Band>,
    );

    const section = screen.getByRole('region', { name: 'Outcome' });
    expect(within(section).getByText('Outcome')).toBeDefined();
    expect(within(section).getByText('shipped it')).toBeDefined();
  });

  it('keeps the section eyebrow outside the band and the body inside it', () => {
    render(<Band label="Agents">Scout</Band>);

    const band = bandOf('Scout');
    expect(band.contains(screen.getByText('Agents'))).toBe(false);
    expect(band.className).toContain('bg-fill');
    expect(band.className).toContain('rounded-lg');
    expect(band.className).toContain('p-1');
  });

  it('labels a group on its first row in sentence case, with a faint count', () => {
    render(
      <Band groupLabel="Explore and plan" groupMeta="3 roles">
        <BandRow>Scout</BandRow>
      </Band>,
    );

    const band = bandOf('Scout');
    const label = within(band).getByText('Explore and plan');
    expect(label.className).toContain('text-label');
    expect(label.className).not.toContain('uppercase');
    expect(within(band).getByText('3 roles').className).toContain('text-faint-foreground');
  });

  it('pads prose at the content inset instead of the row inset', () => {
    render(<Band inset="content">shipped it</Band>);

    expect(bandOf('shipped it').className).toContain('p-3');
  });

  it('labels the section with an eyebrow by default, adding nothing to the outline', () => {
    render(<Band label="Expected output">commits on the branch</Band>);

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('Expected output').className).toContain('text-eyebrow');
  });

  it('promotes the label to a heading when a reading surface asks for one', () => {
    render(
      <Band label="Outcome" headingSize="page" hint="what the agent produced">
        shipped it
      </Band>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Outcome' })).toBeDefined();
    expect(screen.getByText('what the agent produced')).toBeDefined();
  });

  it('names the band as a region only when it is given a name', () => {
    const { rerender } = render(<Band label="Preview">body</Band>);
    expect(screen.queryByRole('region')).toBeNull();

    rerender(
      <Band label="Preview" ariaLabel="Preview">
        body
      </Band>,
    );
    expect(screen.getByRole('region', { name: 'Preview' })).toBeDefined();
  });

  it('throws when a band is put inside another band', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() =>
      render(
        <Band>
          <Band>nested</Band>
        </Band>,
      ),
    ).toThrow('A band never sits inside another band');
    quiet.mockRestore();
  });

  it('stacks sibling bands 8px apart and rounds rows concentric to the band', () => {
    render(
      <BandStack className="probe">
        <Band>
          <BandRow isInteractive>Scout</BandRow>
        </Band>
      </BandStack>,
    );

    expect(screen.getByText('Scout').className).toContain('rounded-sm');
    expect(screen.getByText('Scout').className).toContain('hover:bg-hover');
    expect(bandOf('Scout').parentElement?.className).toContain('gap-2');
  });

  it('stripes even rows on fill and rounds the ends of a striped row', () => {
    expect(STRIPED_ROW).toContain('even:[&>*]:bg-fill');
    expect(STRIPED_ROW).toContain('[&>*:first-child]:rounded-l-sm');
    expect(STRIPED_ROW).toContain('[&>*:last-child]:rounded-r-sm');
    expect(STRIPED_TABLE).toContain('border-separate');
  });

  it('stripes even children of a list, or the visible row of each even block', () => {
    expect(STRIPED_LIST).toContain('[&>*:nth-child(even)]:bg-fill');
    expect(STRIPED_LIST).toContain('[&>*]:rounded-sm');
    expect(STRIPED_BLOCK_LIST).toContain('[&>*:nth-child(even)>:first-child]:bg-fill');
  });
});
