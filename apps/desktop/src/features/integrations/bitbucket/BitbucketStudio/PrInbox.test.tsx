import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PrInbox } from './PrInbox';

afterEach(cleanup);

describe('PrInbox', () => {
  it('offers a retry when the pull request fetch fails', () => {
    const onRefresh = vi.fn();
    render(
      <PrInbox
        groups={[]}
        focusedPrId={null}
        onSelect={vi.fn()}
        loading={false}
        error="Network error"
        onRefresh={onRefresh}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
