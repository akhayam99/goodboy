// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { U34_T39_SCENES } from './t39';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the u34 load state scenes', () => {
  it('registers the run loading scene and draws the run skeleton', () => {
    expect(MOCK_SCENES['u34-t39-run-loading']).toBe(U34_T39_SCENES['u34-t39-run-loading']);
    const Scene = U34_T39_SCENES['u34-t39-run-loading'];
    render(<Scene />);

    screen.getByRole('status', { name: 'Loading run' });
    expect(screen.getAllByRole('status', { name: 'Loading steps' })).toHaveLength(3);
  });

  it('registers the palette loading scene and draws skeleton rows after 120 ms', () => {
    expect(MOCK_SCENES['u34-t39-palette-loading']).toBe(U34_T39_SCENES['u34-t39-palette-loading']);
    const Scene = U34_T39_SCENES['u34-t39-palette-loading'];
    render(<Scene />);
    act(() => {
      vi.advanceTimersByTime(130);
    });

    expect(screen.getAllByRole('status', { name: 'Loading commands' })).toHaveLength(3);
    expect(screen.queryByText('Nothing to do here yet')).toBeNull();
  });
});
