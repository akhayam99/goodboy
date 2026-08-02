// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Dialog } from '../components/Dialog';

afterEach(cleanup);

describe('Dialog', () => {
  it('focuses the first enabled field in the dialog body', () => {
    render(
      <Dialog open onClose={() => undefined} title="Add workspace">
        <div className="flex flex-col gap-2">
          <input aria-label="Workspace path" />
          <button type="button">Secondary action</button>
        </div>
      </Dialog>,
    );

    expect(screen.getByRole('button', { name: 'close' })).not.toBe(document.activeElement);
    expect(screen.getByLabelText('Workspace path')).toBe(document.activeElement);
  });
});
