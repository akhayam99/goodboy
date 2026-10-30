// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRevealToolCall } from '.';

const scrollIntoView = vi.fn();

afterEach(() => {
  scrollIntoView.mockReset();
});

const bodyOf = (): HTMLDivElement => {
  const body = document.createElement('div');
  document.body.append(body);
  Element.prototype.scrollIntoView = scrollIntoView;
  return body;
};

type RowParams = {
  readonly ids: string;
};

const rowOf = ({ ids }: RowParams): HTMLLIElement => {
  const row = document.createElement('li');
  row.dataset.toolUseIds = ids;
  return row;
};

describe('useRevealToolCall', () => {
  it('waits for the transcript to render the row, then scrolls to it once', async () => {
    const body = bodyOf();
    renderHook(() => useRevealToolCall({ bodyRef: { current: body }, toolUseId: 'toolu-2' }));
    expect(scrollIntoView).not.toHaveBeenCalled();

    body.append(rowOf({ ids: 'toolu-1 toolu-2' }));

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledOnce());
    body.append(rowOf({ ids: 'toolu-3' }));
    await Promise.resolve();
    expect(scrollIntoView).toHaveBeenCalledOnce();
  });

  it('does nothing without a call to reveal', () => {
    const body = bodyOf();
    body.append(rowOf({ ids: 'toolu-1' }));

    renderHook(() => useRevealToolCall({ bodyRef: { current: body }, toolUseId: null }));

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
