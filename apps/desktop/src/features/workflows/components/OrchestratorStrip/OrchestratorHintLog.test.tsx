// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { GoalAttachment, IsoDateTime, OrchestratorHint } from '@goodboy/types';
import { OrchestratorHintLog } from './OrchestratorHintLog';

afterEach(cleanup);

const AT = '2026-10-03T09:00:00.000Z' as IsoDateTime;

const TRACE: GoalAttachment = {
  id: 'att-trace',
  ownerType: 'workflow_run',
  ownerId: 'run-1',
  relPath: '.goodboy/attachments/att-trace-checkout-trace.png',
  kind: 'image',
  fileName: 'checkout-trace.png',
  mimeType: 'image/png',
  createdAt: AT,
};

const hint = (over: Partial<OrchestratorHint>): OrchestratorHint => ({
  id: 'hint',
  text: 'keep it to one PR',
  createdAt: AT,
  ...over,
});

const renderLog = (hints: ReadonlyArray<OrchestratorHint>) =>
  render(
    <OrchestratorHintLog
      hints={hints}
      readingHintIds={[]}
      runAttachments={[TRACE]}
      onRemove={() => undefined}
    />,
  );

const openQueued = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /queued/ }));
};

describe('OrchestratorHintLog', () => {
  it('reads a hint as markdown, with its lines and its image', () => {
    renderLog([
      hint({
        id: 'multi',
        text: 'Northwind sandbox still returns 502:\n- keep the **idempotency key**\n- do not touch `retry.ts`',
        attachmentIds: ['att-trace'],
      }),
    ]);
    openQueued();
    const text = screen.getByTestId('orchestrator-hint-text');
    expect(Array.from(text.querySelectorAll('li')).map((item) => item.textContent)).toEqual([
      'keep the idempotency key',
      'do not touch retry.ts',
    ]);
    expect(text.querySelector('strong')?.textContent).toBe('idempotency key');
    expect(text.querySelector('code')?.textContent).toBe('retry.ts');
    expect(
      within(screen.getByRole('list', { name: 'Hint files' })).getByText('checkout-trace.png'),
    ).toBeDefined();
  });

  it('folds a long hint behind Show more', () => {
    renderLog([
      hint({ text: Array.from({ length: 8 }, (_, index) => `line ${index}`).join('\n') }),
    ]);
    openQueued();
    const toggle = screen.getByRole('button', { name: 'Show more' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Show less' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  it('keeps a short hint open', () => {
    renderLog([hint({})]);
    openQueued();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('folds the queued hints into one row that says how many, closed at first', () => {
    renderLog([hint({ id: 'a' }), hint({ id: 'b', text: 'map ledger first' })]);

    const row = screen.getByRole('button', { name: /2 queued/ });
    expect(row.textContent).toContain('Read at the next decision');
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'Hints' })).toBeNull();
  });

  it('opens the queued hints in place under the row, and folds them again', () => {
    renderLog([hint({ id: 'a' }), hint({ id: 'b', text: 'map ledger first' })]);

    const row = screen.getByRole('button', { name: /2 queued/ });
    fireEvent.click(row);
    const list = screen.getByRole('list', { name: 'Hints' });

    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(row.getAttribute('aria-controls')).toBe(list.id);
    expect(within(list).getAllByTestId('orchestrator-hint-row')).toHaveLength(2);
    fireEvent.click(row);
    expect(screen.queryByRole('list', { name: 'Hints' })).toBeNull();
  });

  it('counts only the queued ones, and shows the hint being read without opening anything', () => {
    render(
      <OrchestratorHintLog
        hints={[hint({ id: 'reading' }), hint({ id: 'queued' })]}
        readingHintIds={['reading']}
        runAttachments={[]}
        onRemove={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: /1 queued/ })).toBeDefined();
    const rows = screen.getAllByTestId('orchestrator-hint-row');
    expect(rows.map((item) => item.getAttribute('data-status'))).toEqual(['reading']);
  });

  it('has no row at all when every hint was read', () => {
    renderLog([hint({ id: 'done', consumedAt: AT, consumedAtStep: 2 })]);

    expect(screen.queryByRole('button', { name: /queued/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Show read (1)' })).toBeDefined();
  });
});
