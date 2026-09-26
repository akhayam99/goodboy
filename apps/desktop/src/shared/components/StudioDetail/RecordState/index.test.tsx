// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecordState } from './index';

describe('RecordState', () => {
  it('renders the native label for every category', () => {
    render(<RecordState category="active" label="In Progress" />);
    expect(screen.getByText('In Progress')).toBeTruthy();
  });

  it.each([
    ['open', 'text-info'],
    ['active', 'text-warning'],
    ['done', 'text-muted-foreground'],
    ['alert', 'text-danger'],
  ] as const)('tones %s with %s, the same map the list row uses', (category, toneClass) => {
    const { container } = render(<RecordState category={category} label="Status" />);
    const icon = container.querySelector('svg');
    expect(icon?.getAttribute('class')).toContain(toneClass);
  });
});
