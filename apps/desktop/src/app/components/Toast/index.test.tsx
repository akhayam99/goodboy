// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { ToastProvider, useToast } from './index';

afterEach(cleanup);

const Trigger = () => {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast('info', 'hello')}>
      show
    </button>
  );
};

describe('ToastStack', () => {
  it('renders the toast stack on the named z-toast layer', async () => {
    const { getByText } = render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await act(async () => {
      getByText('show').click();
    });

    expect(document.body.querySelector('.z-toast')).not.toBeNull();
  });
});
