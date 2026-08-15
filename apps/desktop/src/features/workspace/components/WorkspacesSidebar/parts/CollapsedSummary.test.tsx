import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CollapsedSummary } from './CollapsedSummary';

afterEach(cleanup);

describe('CollapsedSummary', () => {
  it('renders the text in a paragraph', () => {
    render(<CollapsedSummary text="3 agents" />);
    const node = screen.getByText('3 agents');
    expect(node.tagName).toBe('P');
  });

  it('renders an empty paragraph for empty text', () => {
    const { container } = render(<CollapsedSummary text="" />);
    expect(container.querySelector('p')?.textContent).toBe('');
  });
});
