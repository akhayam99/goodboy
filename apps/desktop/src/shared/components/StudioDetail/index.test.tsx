import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StudioWidget } from '@goodboy/ui';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('StudioWidget', () => {
  it('renders the section label, action, and card body', () => {
    render(
      <StudioWidget
        label="description"
        presentation="section"
        action={<button type="button">Edit</button>}
      >
        <p>Body copy</p>
      </StudioWidget>,
    );

    expect(screen.getByText('description')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined();
    expect(screen.getByText('Body copy')).toBeDefined();
  });

  it('renders a frameless body without card styling', () => {
    render(
      <StudioWidget label="description" presentation="section" variant="frameless">
        <p>Primary body</p>
      </StudioWidget>,
    );

    const body = screen.getByText('Primary body').parentElement;
    expect(body?.className).toBe('');
  });
});
