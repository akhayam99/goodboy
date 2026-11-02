// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReviewPushLine } from '.';

afterEach(cleanup);

describe('ReviewPushLine', () => {
  it('draws nothing when every commit is pushed', () => {
    render(<ReviewPushLine count={0} isBusy={false} onPush={vi.fn()} />);

    expect(screen.queryByTestId('review-push-line')).toBeNull();
  });

  it('counts the commits and pushes on press', () => {
    const onPush = vi.fn();
    render(<ReviewPushLine count={3} isBusy={false} onPush={onPush} />);

    expect(screen.getByTestId('review-push-line').textContent).toContain('3 commits not pushed');
    fireEvent.click(screen.getByRole('button', { name: 'Push these' }));

    expect(onPush).toHaveBeenCalledTimes(1);
  });

  it('disables the button while another write runs', () => {
    render(<ReviewPushLine count={1} isBusy onPush={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Push these' }).hasAttribute('disabled')).toBe(true);
  });
});
