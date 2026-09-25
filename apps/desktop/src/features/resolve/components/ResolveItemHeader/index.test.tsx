// @vitest-environment happy-dom

import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ResolveItemHeader } from './index';

afterEach(cleanup);

it('keeps traversal, back, overflow and the primary action reachable', () => {
  const onAction = vi.fn();
  render(
    <ResolveItemHeader
      title="Comment"
      location="src/retry.ts:84"
      prNumber={12}
      status="ready"
      nextStep="Approved changes stay local"
      actions={{
        primary: { id: 'resolve', label: 'Resolve', disabledReason: null },
        secondary: { id: 'fix_it', label: 'Fix it', disabledReason: null },
        overflow: [{ id: 'close', label: 'Close', disabledReason: null }],
      }}
      isEditing={false}
      canPrevious={false}
      canNext
      onBack={vi.fn()}
      onPrevious={vi.fn()}
      onNext={vi.fn()}
      onAction={onAction}
    />,
  );

  expect(screen.getByRole('button', { name: 'Previous comment' }).hasAttribute('disabled')).toBe(
    true,
  );
  expect(screen.getByRole('button', { name: 'Next comment' }).hasAttribute('disabled')).toBe(false);
  expect(screen.getByRole('button', { name: 'Resolve' }).hasAttribute('data-resolve-primary')).toBe(
    true,
  );
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  expect(screen.getByRole('menuitem', { name: 'Close' })).toBeDefined();
});
