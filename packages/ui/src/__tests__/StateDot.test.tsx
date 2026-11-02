// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StateDot } from '../components/StateDot';

afterEach(cleanup);

describe('StateDot', () => {
  it('paints unread in the quiet unread tone, never the primary used by buttons', () => {
    render(<StateDot state="unread" label="Unread" />);

    const dot = screen.getByLabelText('Unread');
    expect(dot.className).toContain('bg-unread');
    expect(dot.className).not.toContain('bg-primary');
  });
});
