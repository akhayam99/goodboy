// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SectionLabel } from '../components/SectionLabel';

afterEach(cleanup);

describe('SectionLabel', () => {
  it('sets the label at level 2, 14/600 in foreground, and the count faint after it', () => {
    render(<SectionLabel label="Steps" count={5} />);

    const label = screen.getByText('Steps');
    expect(label.className).toContain('text-heading');
    expect(label.className).toContain('text-foreground');
    const count = screen.getByText('5');
    expect(count.className).toContain('text-ui');
    expect(count.className).toContain('text-faint-foreground');
    expect(count.className).toContain('tabular-nums');
    expect(label.compareDocumentPosition(count)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('is a plain span until it is given a heading level', () => {
    const { rerender } = render(<SectionLabel label="Steps" />);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('Steps').tagName).toBe('SPAN');

    rerender(<SectionLabel label="Steps" headingLevel={2} />);
    screen.getByRole('heading', { level: 2, name: 'Steps' });

    rerender(<SectionLabel label="Steps" headingLevel={3} />);
    screen.getByRole('heading', { level: 3, name: 'Steps' });
  });

  it('draws no count slot without a count', () => {
    const { container } = render(<SectionLabel label="Steps" />);

    expect(container.querySelectorAll('[data-section-label] ~ span')).toHaveLength(0);
  });
});
