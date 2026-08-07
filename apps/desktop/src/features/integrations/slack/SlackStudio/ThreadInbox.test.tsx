import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThreadInbox } from './ThreadInbox';

afterEach(cleanup);

describe('ThreadInbox', () => {
  it('offers a retry when the thread fetch fails', () => {
    const onRefresh = vi.fn();
    render(
      <ThreadInbox
        groups={[]}
        focusedThreadTs={null}
        onSelect={vi.fn()}
        isLoading={false}
        error="Network error"
        onRefresh={onRefresh}
        hiddenChannelCount={0}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
