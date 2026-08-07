import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IssueInbox } from './IssueInbox';

afterEach(cleanup);

describe('IssueInbox', () => {
  it('offers a retry when the issue fetch fails', () => {
    const onRefresh = vi.fn();
    render(
      <IssueInbox
        groups={[]}
        focusedIssueId={null}
        onSelect={vi.fn()}
        isLoading={false}
        error="Network error"
        onRefresh={onRefresh}
        emptyDescription="No open issues assigned to you."
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
