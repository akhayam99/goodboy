// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { ToastsFirer } from './ToastsFirer';

afterEach(cleanup);

const mount = ({ variant }: { readonly variant: string }) =>
  render(
    <ToastProvider>
      <ToastsFirer variant={variant} />
    </ToastProvider>,
  );

describe('ToastsFirer after the toast cleanup', () => {
  it('fires only the outcomes that arrive while you are elsewhere, at most two', () => {
    mount({ variant: 'after' });

    screen.getByText('Handoff degraded');
    screen.getByText('Push to payments-api failed');
    expect(screen.queryByText('Rebase started')).toBeNull();
    expect(screen.queryByText('Agent started')).toBeNull();
    expect(screen.queryByText(/for the rest of this session/)).toBeNull();
    expect(screen.queryByText(/^Updated to/)).toBeNull();
  });
});
