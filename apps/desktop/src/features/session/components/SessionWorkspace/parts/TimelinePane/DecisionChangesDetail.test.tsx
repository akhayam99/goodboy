// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { decisionChangeDetail } from '../../../../timeline/decisionChangeLines';
import {
  installFakeResizeObserver,
  type FakeResizeObservers,
} from '../../../../../../test/fakeResizeObserver';
import { DecisionChangesDetail } from './DecisionChangesDetail';

const LONG_TEXT =
  'Show the stuck-delivery banner after the third failed retry, not the first, so one provider hiccup never alarms a Harborline operator while the ledger-core queue is still draining on its own schedule overnight';

let observers: FakeResizeObservers;
let height = 120;

beforeEach(() => {
  observers = installFakeResizeObserver();
  height = 120;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, 0, 400, height),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const longDetail = () => {
  const detail = decisionChangeDetail({
    payload: {
      decisionChanges: [
        {
          kind: 'replaced',
          number: 5,
          by: 7,
          text: LONG_TEXT,
          reason: 'You answered: three retries, one is normal provider noise',
        },
      ],
    },
  });
  if (detail === null) {
    throw new Error('expected a detail');
  }
  return detail;
};

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
    render(
      <DecisionChangesDetail
        id="d"
        rowId="event:e1"
        detail={detail}
        onOpenInContext={onOpenInContext}
        onMeasured={vi.fn()}
      />,
    );

    expect(screen.getByText('D12')).toBeDefined();
    expect(screen.getByText('withdrawn: drift')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open in Context' }));
    expect(onOpenInContext).toHaveBeenCalledTimes(1);
  });

  it('shows a 200 character sentence whole, with its id and its note', () => {
    render(
      <DecisionChangesDetail
        id="d"
        rowId="event:e1"
        detail={longDetail()}
        onOpenInContext={vi.fn()}
        onMeasured={vi.fn()}
      />,
    );
    const text = screen.getByText(LONG_TEXT);

    expect(LONG_TEXT.length).toBeGreaterThanOrEqual(200);
    expect(
      screen.getByText('You answered: three retries, one is normal provider noise'),
    ).toBeDefined();
    expect(screen.getByText('D5 → D7')).toBeDefined();
    expect(text.closest('div')?.getAttribute('style')).toBeNull();
  });

  it('reports its measured height before the first frame and again on every resize', () => {
    const onMeasured = vi.fn();
    render(
      <DecisionChangesDetail
        id="d"
        rowId="event:e1"
        detail={longDetail()}
        onOpenInContext={vi.fn()}
        onMeasured={onMeasured}
      />,
    );

    expect(onMeasured).toHaveBeenLastCalledWith({ rowId: 'event:e1', height: 120 });
    height = 218;
    act(() => observers.resizeAll());
    expect(onMeasured).toHaveBeenLastCalledWith({ rowId: 'event:e1', height: 218 });
  });

  it('stops observing once it unmounts', () => {
    const { unmount } = render(
      <DecisionChangesDetail
        id="d"
        rowId="event:e1"
        detail={longDetail()}
        onOpenInContext={vi.fn()}
        onMeasured={vi.fn()}
      />,
    );
    expect(observers.observedCount()).toBe(1);
    unmount();
    expect(observers.observedCount()).toBe(0);
  });
});
