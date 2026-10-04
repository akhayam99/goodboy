// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ClampedText } from '.';

afterEach(cleanup);

describe('ClampedText', () => {
  it('leaves short text open without a disclosure', () => {
    render(<ClampedText text="Short note">Short note</ClampedText>);

    screen.getByText('Short note');
    expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull();
  });

  it('marks long text as clamped until the reader opens it', () => {
    const text = Array.from({ length: 9 }, (_, index) => `Line ${index + 1}`).join('\n');
    const { container } = render(<ClampedText text={text}>{text}</ClampedText>);

    expect(container.querySelector('[data-clamped="true"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(container.querySelector('[data-clamped="true"]')).toBeNull();
    screen.getByRole('button', { name: 'Show less' });
  });
});
