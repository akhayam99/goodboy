import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepRow } from './StepRow';

afterEach(cleanup);

describe('StepRow', () => {
  it('opens a quiet step from the whole row, named by its action, with no action text', () => {
    const onOpen = vi.fn();
    render(
      <ul>
        <StepRow
          title="Tools"
          detail="Optional"
          actionLabel="Open"
          isLead={false}
          onOpen={onOpen}
        />
      </ul>,
    );

    const row = screen.getByRole('button', { name: 'Open Tools' });
    fireEvent.click(row);

    expect(onOpen).toHaveBeenCalledOnce();
    expect(row.textContent).not.toContain('Open');
    expect(screen.getByText('Optional')).toBeDefined();
  });

  it('gives the lead step its secondary action button', () => {
    const onOpen = vi.fn();
    render(
      <ul>
        <StepRow title="Tools" detail="Optional" actionLabel="Start" isLead onOpen={onOpen} />
      </ul>,
    );

    const primary = screen.getByRole('button', { name: 'Start Tools' });
    fireEvent.click(primary);

    expect(primary.getAttribute('data-variant')).toBe('secondary');
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('shows an unfinished step without an action when none can run here', () => {
    render(
      <ul>
        <StepRow title="Tools" detail="Optional" actionLabel="Open" isLead onOpen={null} />
      </ul>,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });
});
