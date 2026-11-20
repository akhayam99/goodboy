// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TitleField } from '.';

afterEach(() => {
  cleanup();
});

type FieldParams = {
  readonly error: string | null;
};

const renderField = ({ error }: FieldParams) =>
  render(
    <TitleField
      density="row"
      ariaLabel="Session name"
      draft="Reconcile the ledger export"
      maxLength={80}
      used={27}
      limit={80}
      error={error}
      canRetry
      isPending={false}
      onRetry={() => undefined}
      onDraftChange={() => undefined}
      onKeyDown={() => undefined}
      onBlur={() => undefined}
    />,
  );

const describedIds = (): ReadonlyArray<string> =>
  (screen.getByRole('textbox', { name: 'Session name' }).getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter((id) => id !== '');

describe('TitleField', () => {
  it('describes the field with the rename error, so it is read again on focus', () => {
    renderField({ error: 'A session with this name already exists.' });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('A session with this name already exists.');
    expect(describedIds()).toContain(alert.id);
    expect(screen.getByRole('textbox', { name: 'Session name' }).getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('describes the field with the limit ring only while nothing failed', () => {
    renderField({ error: null });

    expect(describedIds()).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
