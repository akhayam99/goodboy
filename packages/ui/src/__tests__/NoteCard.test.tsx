// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NoteCard } from '../components/NoteCard';

afterEach(cleanup);

describe('NoteCard', () => {
  it('renders the header node and the markdown body', () => {
    render(<NoteCard header={<span>Ada Lovelace</span>} body="Pipeline is **green**." />);

    expect(screen.getByText('Ada Lovelace')).toBeDefined();
    expect(screen.getByText('green')).toBeDefined();
  });
});
