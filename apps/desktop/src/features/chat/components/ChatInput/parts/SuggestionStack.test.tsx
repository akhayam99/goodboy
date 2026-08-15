import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SuggestionStack } from './SuggestionStack';

afterEach(cleanup);

const item = (key: string) => ({ key, node: <span>{key}</span> });

describe('SuggestionStack', () => {
  it('renders nothing when there are no items', () => {
    const { container } = render(<SuggestionStack items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders only the first item and no toggle for a single item', () => {
    render(<SuggestionStack items={[item('a')]} />);
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides the rest behind a toggle that counts them', () => {
    render(<SuggestionStack items={[item('a'), item('b'), item('c')]} />);
    expect(screen.queryByText('b')).toBeNull();
    expect(screen.getByRole('button').textContent).toBe('+2 more suggestions');
  });

  it('uses the singular label for exactly one hidden item', () => {
    render(<SuggestionStack items={[item('a'), item('b')]} />);
    expect(screen.getByRole('button').textContent).toBe('+1 more suggestion');
  });

  it('expands and collapses the rest', () => {
    render(<SuggestionStack items={[item('a'), item('b')]} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('b')).toBeTruthy();
    expect(screen.getByRole('button').textContent).toBe('show fewer suggestions');
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('b')).toBeNull();
  });
});
