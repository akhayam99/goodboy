// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LensShortcutActions } from './LensShortcutActions';

afterEach(cleanup);

describe('LensShortcutActions', () => {
  it('selects the terminal lens', () => {
    const onSelectLens = vi.fn();
    render(<LensShortcutActions onSelectLens={onSelectLens} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open the terminal' }));

    expect(onSelectLens).toHaveBeenCalledWith('terminal');
  });

  it('selects the scripts lens', () => {
    const onSelectLens = vi.fn();
    render(<LensShortcutActions onSelectLens={onSelectLens} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open the scripts' }));

    expect(onSelectLens).toHaveBeenCalledWith('scripts');
  });
});
