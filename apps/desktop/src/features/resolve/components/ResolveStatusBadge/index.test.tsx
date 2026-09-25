// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RESOLVE_QUEUE_NEXT_STEP } from '../../resolveQueueCopy';
import { RESOLVE_UI_STATE_LABEL, type ResolveUiState } from '../../resolveRowState';
import { ResolveStatusBadge, resolveStatusAccessibleName } from './index';

afterEach(() => {
  cleanup();
});

describe('ResolveStatusBadge', () => {
  it('names one of eight states and tells what comes next', () => {
    expect(Object.keys(RESOLVE_UI_STATE_LABEL)).toHaveLength(8);
    expect(resolveStatusAccessibleName({ status: 'ready' })).toBe(
      `${RESOLVE_UI_STATE_LABEL.ready}. ${RESOLVE_QUEUE_NEXT_STEP.ready ?? ''}`,
    );
    expect(resolveStatusAccessibleName({ status: 'resolved' })).toBe(
      RESOLVE_UI_STATE_LABEL.resolved,
    );
  });

  it('renders the state label for every state', () => {
    for (const status of Object.keys(RESOLVE_UI_STATE_LABEL) as ReadonlyArray<ResolveUiState>) {
      const { unmount } = render(<ResolveStatusBadge status={status} />);
      expect(screen.getByText(RESOLVE_UI_STATE_LABEL[status])).toBeTruthy();
      unmount();
    }
  });
});
