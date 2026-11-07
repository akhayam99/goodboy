// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId, type ProviderRunId } from '@goodboy/types';
import type { ConversationRow } from '../../utils/conversationRows';
import { useReadingOrder } from '.';

const RUN = brandId<ProviderRunId>({ value: 'run-ledger-core' });
const ROWS: ReadonlyArray<ConversationRow> = ['Reading ledger-core', 'The retry is fixed.'].map(
  (text, index) => ({
    kind: 'item',
    key: `text-${index}`,
    item: { kind: 'assistant_text', key: `text-${index}`, text, runId: RUN },
  }),
);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

type OpenParams = { readonly isAbove: boolean };

const open = ({ isAbove }: OpenParams) => {
  const viewport = document.createElement('div');
  viewport.className = 'overflow-y-auto';
  document.body.append(viewport);
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 100, 500, 500));
  const { result, rerender } = renderHook(
    ({ activeRunId }: { readonly activeRunId: ProviderRunId | null }) =>
      useReadingOrder({ rows: ROWS, activeRunId }),
    { initialProps: { activeRunId: RUN } },
  );
  const rectangles = { isAbove };
  for (const row of ROWS) {
    const element = document.createElement('li');
    viewport.append(element);
    vi.spyOn(element, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(0, rectangles.isAbove ? 0 : 120, 400, 50),
    );
    result.current.register({ key: row.key, element });
  }
  return { result, rerender, viewport, rectangles };
};

describe('reading a live reply', () => {
  it('does not fold the reply when it ends on screen', () => {
    const { result, rerender } = open({ isAbove: false });
    rerender({ activeRunId: null });
    expect(result.current.roles.size).toBe(0);
  });
  it('folds a completed live reply only after its text is above the viewport', () => {
    const { result, rerender, viewport, rectangles } = open({ isAbove: false });
    rerender({ activeRunId: null });
    rectangles.isAbove = true;
    act(() => viewport.dispatchEvent(new Event('scroll')));
    expect(result.current.roles.get('text-0')).toMatchObject({ kind: 'notes' });
  });
  it('folds text already above the viewport when the live reply ends', () => {
    const { result, rerender } = open({ isAbove: true });
    rerender({ activeRunId: null });
    expect(result.current.roles.get('text-0')).toMatchObject({ kind: 'notes' });
  });
});
