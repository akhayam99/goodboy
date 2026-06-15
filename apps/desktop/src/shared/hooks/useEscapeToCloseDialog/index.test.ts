import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useEscapeToCloseDialog } from './index';

const openDialog = (): HTMLDialogElement => {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('open', '');
  document.body.appendChild(dialog);
  return dialog;
};

const pressKey = (key: string) => {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('useEscapeToCloseDialog', () => {
  it('closes an open dialog on Escape', () => {
    renderHook(() => useEscapeToCloseDialog());
    const dialog = openDialog();
    pressKey('Escape');
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('leaves the dialog open for other keys', () => {
    renderHook(() => useEscapeToCloseDialog());
    const dialog = openDialog();
    pressKey('Enter');
    expect(dialog.hasAttribute('open')).toBe(true);
  });

  it('closes only the topmost dialog', () => {
    renderHook(() => useEscapeToCloseDialog());
    const first = openDialog();
    const second = openDialog();
    pressKey('Escape');
    expect(second.hasAttribute('open')).toBe(false);
    expect(first.hasAttribute('open')).toBe(true);
  });
});
