// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ActionControls } from '../../useActionControls';
import { ActionStatusLine } from './ActionStatusLine';

const merge = {
  id: 'pullRequest.merge',
  shortLabel: 'Squash and merge',
  label: 'Squash and merge',
  blockedReason: 'Checks are still running.',
};

const controlsOf = ({ failed }: { readonly failed: boolean }): ActionControls =>
  ({
    inSlot: ({ slot }: { readonly slot: string }) => (slot === 'secondary' ? [merge] : []),
    actions: [merge],
    failure: failed ? { actionId: merge.id, message: 'GitHub refused.' } : null,
    retry: vi.fn(),
  }) as unknown as ActionControls;

afterEach(() => {
  cleanup();
});

describe('ActionStatusLine', () => {
  it('lists the blocked reason of a visible action by default', () => {
    render(<ActionStatusLine controls={controlsOf({ failed: false })} />);

    expect(screen.getByText('Checks are still running.')).toBeDefined();
  });

  it('leaves blocked reasons to the page and keeps a failure with its retry', () => {
    const { container } = render(
      <ActionStatusLine controls={controlsOf({ failed: false })} showReasons={false} />,
    );
    expect(container.textContent).toBe('');
    cleanup();

    render(<ActionStatusLine controls={controlsOf({ failed: true })} showReasons={false} />);
    expect(screen.queryByText('Checks are still running.')).toBeNull();
    screen.getByRole('button', { name: 'Retry' });
  });
});
