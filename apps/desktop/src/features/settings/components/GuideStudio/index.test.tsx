// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { GuideStudio } from './index';

afterEach(cleanup);

describe('GuideStudio', () => {
  it('renders the studio title', () => {
    render(<GuideStudio onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /getting started/i })).toBeDefined();
  });

  it('renders nav items including Overview, Stage board, and Sessions', () => {
    render(<GuideStudio onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^overview$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^stage board$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^sessions$/i })).toBeDefined();
  });
});
