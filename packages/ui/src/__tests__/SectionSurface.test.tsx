// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SECTION_SURFACE_CLASS, SectionSurface } from '../components/SectionSurface';

afterEach(cleanup);

const carriesSurface = (element: Element | null): boolean =>
  element !== null &&
  SECTION_SURFACE_CLASS.split(' ').every((token) => element.classList.contains(token));

describe('SectionSurface', () => {
  it('raises the section onto the shared surface instead of leaning on vertical space', () => {
    const { container } = render(<SectionSurface label="Outcome">shipped it</SectionSurface>);

    expect(carriesSurface(container.querySelector('section'))).toBe(true);
    expect(screen.getByText('shipped it')).toBeDefined();
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
