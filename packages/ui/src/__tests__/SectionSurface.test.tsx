// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { SectionSurface } from '../components/SectionSurface';

afterEach(cleanup);

describe('SectionSurface', () => {
  it('holds its label and its body in one section', () => {
    render(
      <SectionSurface label="Outcome" ariaLabel="Outcome">
        shipped it
      </SectionSurface>,
    );

    const section = screen.getByRole('region', { name: 'Outcome' });
    expect(within(section).getByText('Outcome')).toBeDefined();
    expect(within(section).getByText('shipped it')).toBeDefined();
  });

  it('labels the section with an eyebrow by default, adding nothing to the outline', () => {
    render(<SectionSurface label="Expected output">commits on the branch</SectionSurface>);

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('Expected output')).toBeDefined();
  });

  it('promotes the label to a heading when a reading surface asks for one', () => {
    render(
      <SectionSurface label="Outcome" headingSize="page" hint="what the agent produced">
        shipped it
      </SectionSurface>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Outcome' })).toBeDefined();
    expect(screen.getByText('what the agent produced')).toBeDefined();
  });

  it('keeps the label in the outline while it stays on the eyebrow grade', () => {
    render(
      <SectionSurface label="Outcome" headingLevel={2}>
        shipped it
      </SectionSurface>,
    );

    const heading = screen.getByRole('heading', { level: 2, name: 'Outcome' });

    expect(heading.className).not.toContain('text-base');
    expect(screen.getByText('Outcome').className).toContain('text-2xs');
  });

  it('names the surface as a region only when it is given a name', () => {
    const { rerender } = render(<SectionSurface label="Preview">body</SectionSurface>);
    expect(screen.queryByRole('region')).toBeNull();

    rerender(
      <SectionSurface label="Preview" ariaLabel="Preview">
        body
      </SectionSurface>,
    );
    expect(screen.getByRole('region', { name: 'Preview' })).toBeDefined();
  });
});
