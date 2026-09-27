// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { decisionChangeDetail } from '../../../../timeline/decisionChangeLines';
import { DecisionChangesDetail } from './DecisionChangesDetail';

afterEach(cleanup);

describe('DecisionChangesDetail', () => {
  it('lists the diff and opens the drawer on the rows it touched', () => {
    const detail = decisionChangeDetail({
      payload: {
        decisionChanges: [
          { kind: 'added', number: 12, text: 'Key on the event id' },
          { kind: 'withdrawn', number: 5, text: 'Retry counter column', reason: 'drift' },
        ],
      },
    });
    if (detail === null) {
      throw new Error('expected a detail');
    }
    const onOpenInContext = vi.fn();
    render(<DecisionChangesDetail id="d" detail={detail} onOpenInContext={onOpenInContext} />);

    expect(screen.getByText('D12')).toBeDefined();
    expect(screen.getByText('· withdrawn: drift')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open in Context' }));
    expect(onOpenInContext).toHaveBeenCalledTimes(1);
  });
});
