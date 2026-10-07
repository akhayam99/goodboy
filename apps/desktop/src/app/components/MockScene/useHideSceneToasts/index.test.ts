// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { useHideSceneToasts } from './index';

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const toastOf = ({ text }: { readonly text: string }): HTMLElement => {
  const node = document.createElement('div');
  node.setAttribute('role', 'status');
  node.textContent = text;
  document.body.append(node);
  return node;
};

describe('useHideSceneToasts', () => {
  it('hides the file drop toast a scene cannot avoid, whatever the scene', async () => {
    renderHook(() => useHideSceneToasts());

    const drop = toastOf({ text: 'File drop is unavailable. Use Attach files instead.' });

    await waitFor(() => expect(drop.style.display).toBe('none'));
  });

  it('leaves every other toast alone', async () => {
    renderHook(() => useHideSceneToasts());

    const saved = toastOf({ text: 'Saved' });
    const drop = toastOf({ text: 'File drop is unavailable. Use Add files instead.' });

    await waitFor(() => expect(drop.style.display).toBe('none'));
    expect(saved.style.display).toBe('');
  });

  it('stops watching once the scene unmounts', async () => {
    const { unmount } = renderHook(() => useHideSceneToasts());
    unmount();

    const drop = toastOf({ text: 'File drop is unavailable. Use Attach files instead.' });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(drop.style.display).toBe('');
  });
});
