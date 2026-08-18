// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SectionHeader } from '../components/SectionHeader';

afterEach(cleanup);

const glyph = <svg data-testid="glyph" />;

describe('SectionHeader, page size', () => {
  it('anchors the glyph on the heading line box instead of the top of the column', () => {
    render(<SectionHeader size="page" label="Decisions" icon={glyph} />);

    const heading = screen.getByRole('heading', { level: 2, name: 'Decisions' });
    const cluster = screen.getByTestId('glyph').parentElement?.parentElement;

    expect(cluster).toBe(heading.parentElement);
    expect(cluster?.className).toContain('items-center');
  });

  it('declares the heading line height so the pair lands on whole pixels', () => {
    render(<SectionHeader size="page" label="Session summary" icon={glyph} />);

    expect(screen.getByRole('heading', { level: 2 }).className).toContain('leading-6');
  });

  it('keeps a taller action out of the pair, so it cannot lift the glyph off the text', () => {
    render(
      <SectionHeader
        size="page"
        label="Decisions"
        icon={glyph}
        action={<button type="button" className="h-7" />}
      />,
    );

    const cluster = screen.getByTestId('glyph').parentElement?.parentElement;

    expect(cluster?.contains(screen.getByRole('button'))).toBe(false);
  });

  it('leaves the description on the same left edge as the glyph and the section body', () => {
    render(
      <SectionHeader
        size="page"
        label="Decisions"
        icon={glyph}
        hint="One row per choice already settled."
      />,
    );

    const hint = screen.getByText('One row per choice already settled.');
    const heading = screen.getByRole('heading', { level: 2 });

    expect(hint.parentElement).toBe(heading.parentElement?.parentElement?.parentElement);
    expect(heading.parentElement?.contains(hint)).toBe(false);
  });
});

describe('SectionHeader, eyebrow size', () => {
  it('labels the section without adding a heading to the outline', () => {
    render(<SectionHeader label="Versions" icon={glyph} hint="restore any of them" />);

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('Versions')).toBeDefined();
    expect(screen.getByText('restore any of them')).toBeDefined();
  });

  it('sits the label on the eyebrow grade and the description one grade under nothing', () => {
    render(<SectionHeader label="Decisions" hint="One row per choice already settled." />);

    expect(screen.getByText('Decisions').className).toContain('text-2xs');
    expect(screen.getByText('One row per choice already settled.').className).toContain('text-2xs');
  });

  it('keeps the heading in the outline when a reading surface asks for one', () => {
    render(<SectionHeader label="Session summary" headingLevel={2} />);

    const heading = screen.getByRole('heading', { level: 2, name: 'Session summary' });

    expect(heading.textContent).toBe('Session summary');
  });

  it('leaves a promoted heading on the eyebrow grade rather than the page grade', () => {
    render(<SectionHeader label="Session summary" headingLevel={2} />);

    const heading = screen.getByRole('heading', { level: 2 });

    expect(heading.className).not.toContain('text-base');
    expect(screen.getByText('Session summary').className).toContain('text-2xs');
  });

  it('takes a third-level heading for a block nested inside a section', () => {
    render(<SectionHeader label="Decisions" headingLevel={3} />);

    expect(screen.getByRole('heading', { level: 3, name: 'Decisions' })).toBeDefined();
  });
});
