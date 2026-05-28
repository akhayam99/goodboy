// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { GuideDialog } from './index';

afterEach(cleanup);

describe('GuideDialog', () => {
  it('renders the dialog title when open', () => {
    render(<GuideDialog open onClose={vi.fn()} />);
    expect(screen.getByText(/getting started/i)).toBeDefined();
  });

  it('renders nav items including Overview and Sessions', () => {
    render(<GuideDialog open onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^overview$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^sessions$/i })).toBeDefined();
  });
});
