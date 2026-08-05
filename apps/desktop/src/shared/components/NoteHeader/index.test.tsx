import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NoteHeader } from './index';

afterEach(cleanup);

describe('NoteHeader', () => {
  it('renders the author and the given avatar and timestamp nodes', () => {
    render(
      <NoteHeader
        avatar={<img src="https://example.com/ada.png" alt="Ada Lovelace" />}
        author="Ada Lovelace"
        timestamp={<span>3d ago</span>}
      />,
    );

    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toBeDefined();
    expect(screen.getByText('Ada Lovelace')).toBeDefined();
    expect(screen.getByText('3d ago')).toBeDefined();
  });

  it('renders no avatar when none is passed', () => {
    render(<NoteHeader author="Ada Lovelace" />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Ada Lovelace')).toBeDefined();
  });

  it('renders no timestamp when none is passed', () => {
    render(<NoteHeader author="Ada Lovelace" />);

    expect(screen.queryByText(/ago/)).toBeNull();
  });
});
