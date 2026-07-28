import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AgentCompletionTabs } from './AgentCompletionTabs';

afterEach(cleanup);

describe('AgentCompletionTabs', () => {
  it('marks the active option and switches on click', () => {
    const onChange = vi.fn();
    render(
      <AgentCompletionTabs
        ariaLabel="Agent status"
        activeCount={2}
        completedCount={3}
        value="active"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Active (2)' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('tablist').className).toContain('grid');
    fireEvent.click(screen.getByRole('tab', { name: 'Completed (3)' }));
    expect(onChange).toHaveBeenCalledWith('completed');
  });

  it('exposes the group label with small tabs', () => {
    render(
      <AgentCompletionTabs
        ariaLabel="Agent status"
        activeCount={2}
        completedCount={3}
        value="completed"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('tablist', { name: 'Agent status' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Completed (3)' }).className).toContain('text-xs');
  });
});
