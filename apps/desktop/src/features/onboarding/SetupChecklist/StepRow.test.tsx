import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepRow } from './StepRow';

afterEach(cleanup);

describe('StepRow', () => {
  it('opens an unfinished step from the whole row, named by its action', () => {
    const onOpen = vi.fn();
    render(
      <ul>
        <StepRow
          title="Tools"
          detail="Optional"
          isDone={false}
          actionLabel="Open"
          onOpen={onOpen}
        />
      </ul>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Tools' }));

    expect(onOpen).toHaveBeenCalledOnce();
    expect(screen.getByText('Optional')).toBeDefined();
  });

  it('draws a done step as a plain row with a check and no action', () => {
    const { container } = render(
      <ul>
        <StepRow
          title="Agents"
          detail="Claude is ready"
          isDone
          actionLabel="Open"
          onOpen={vi.fn()}
        />
      </ul>,
    );

    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('[data-state="done"] svg')).not.toBeNull();
    expect(screen.getByText('Claude is ready')).toBeDefined();
  });

  it('shows an unfinished step without an action when none can run here', () => {
    render(
      <ul>
        <StepRow title="Tools" detail="Optional" isDone={false} actionLabel="Open" onOpen={null} />
      </ul>,
    );

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('Open')).toBeNull();
  });
});
