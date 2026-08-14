import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Avatar } from '@goodboy/ui';

afterEach(cleanup);

describe('Avatar', () => {
  it('renders the image with the given src and accessible name', () => {
    render(<Avatar url="https://example.com/ada.png" alt="Ada Lovelace" />);

    const avatar = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(avatar.getAttribute('src')).toBe('https://example.com/ada.png');
  });

  it('marks the image decorative when alt is empty', () => {
    render(<Avatar url="https://example.com/ada.png" alt="" />);

    expect(screen.queryByRole('img')).toBeNull();
    const img = document.querySelector('img');
    expect(img?.getAttribute('aria-hidden')).toBe('true');
  });

  it('falls back to the initial when there is no url', () => {
    render(<Avatar url={null} alt="Bo" />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('B')).toBeDefined();
  });

  it('falls back to a question mark when the name is empty', () => {
    render(<Avatar url={null} alt="" />);

    expect(screen.getByText('?')).toBeDefined();
  });

  it('derives the fallback initial from initialsSource when the img is decorative', () => {
    render(<Avatar url={null} alt="" initialsSource="Ada Lovelace" />);

    expect(screen.getByText('A')).toBeDefined();
  });

  it('falls back to the initial after the image fails to load', () => {
    render(<Avatar url="https://example.com/broken.png" alt="Ada Lovelace" />);

    const avatar = screen.getByRole('img', { name: 'Ada Lovelace' });
    fireEvent.error(avatar);

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('A')).toBeDefined();
  });
});
