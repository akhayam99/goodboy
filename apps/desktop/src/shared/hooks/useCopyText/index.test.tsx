// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { ToastContext } from '../../components/Toast/toastContext';
import { useCopyText } from './index';

afterEach(cleanup);

const setup = ({ writeText }: { readonly writeText: (text: string) => Promise<void> }) => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  Object.defineProperty(document, 'execCommand', {
    value: () => false,
    configurable: true,
    writable: true,
  });
  const showToast = vi.fn();
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <ToastContext.Provider value={{ showToast, previewNotification: vi.fn() }}>
      {children}
    </ToastContext.Provider>
  );
  const hook = renderHook(() => useCopyText(), { wrapper });
  return { copyText: hook.result.current, showToast };
};

describe('useCopyText', () => {
  it('copies quietly when the clipboard accepts the text', async () => {
    const writeText = vi.fn(async () => undefined);
    const { copyText, showToast } = setup({ writeText });

    await copyText({ text: 'main' });

    expect(writeText).toHaveBeenCalledWith('main');
    expect(showToast).not.toHaveBeenCalled();
  });

  it('tells the user when the clipboard refuses the text', async () => {
    const { copyText, showToast } = setup({
      writeText: async () => Promise.reject(new Error('no')),
    });

    await copyText({ text: 'main' });

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'warning', title: 'Copy failed' }),
    );
  });
});
