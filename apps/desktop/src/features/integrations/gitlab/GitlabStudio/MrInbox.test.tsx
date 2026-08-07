import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MrInbox } from './MrInbox';

afterEach(cleanup);

describe('MrInbox', () => {
  it('offers a retry when the merge request fetch fails', () => {
    const onRefresh = vi.fn();
    render(
      <MrInbox
        groups={[]}
        focusedMrId={null}
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
