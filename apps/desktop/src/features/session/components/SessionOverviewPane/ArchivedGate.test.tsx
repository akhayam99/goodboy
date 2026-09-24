// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ArchivedGate } from './ArchivedGate';

afterEach(cleanup);

describe('ArchivedGate', () => {
  it('disables what it wraps on an archived session and says why', () => {
    render(
      <ArchivedGate isArchived>
        <button type="button">Add workflow</button>
      </ArchivedGate>,
    );

    const group = screen.getByRole('group', { name: 'Restore this session to continue' });
    expect(group.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Add workflow' }).closest('fieldset')).toBe(group);
  });

  it('leaves a live session alone', () => {
    render(
      <ArchivedGate isArchived={false}>
        <button type="button">Add workflow</button>
      </ArchivedGate>,
    );

    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add workflow' }).matches(':disabled')).toBe(false);
  });
});
