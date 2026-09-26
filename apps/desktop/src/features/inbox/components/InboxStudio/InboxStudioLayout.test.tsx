import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DRAWER_INSET, RIGHT_DRAWER_MAX, RIGHT_DRAWER_STORAGE_KEY } from '@goodboy/ui';
import { InboxStudioLayout } from './InboxStudioLayout';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('InboxStudioLayout', () => {
  it('keeps the drawer column closed while nothing is open', () => {
    render(<InboxStudioLayout rail={<nav>facets</nav>} list={<p>rows</p>} drawer={null} />);

    const drawer = screen.getByRole('complementary', { name: 'Inbox item' });
    expect(drawer.getAttribute('data-drawer-mode')).toBe('closed');
    expect(drawer.style.width).toBe('0px');
    expect(screen.getByRole('complementary', { name: 'Inbox filters' })).toBeDefined();
  });

  it('opens the record in a drawer at the one saved width, clamped', () => {
    localStorage.setItem(RIGHT_DRAWER_STORAGE_KEY, '900');

    render(<InboxStudioLayout rail={null} list={<p>rows</p>} drawer={<p>record</p>} />);

    const drawer = screen.getByRole('complementary', { name: 'Inbox item' });
    expect(drawer.style.width).toBe(`${RIGHT_DRAWER_MAX + DRAWER_INSET * 2}px`);
    expect(drawer.getAttribute('data-drawer-mode')).toBe('push');
  });

  it('saves the width the drawer is resized to', () => {
    render(<InboxStudioLayout rail={null} list={<p>rows</p>} drawer={<p>record</p>} />);

    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize the item panel' }), {
      key: 'ArrowLeft',
    });

    expect(localStorage.getItem(RIGHT_DRAWER_STORAGE_KEY)).toBe('408');
  });
});
