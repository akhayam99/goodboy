// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { reloadSurfaces } from './reloadSurfaces';

const mountPane = () => {
  const root = document.createElement('div');
  const closeButton = document.createElement('button');
  root.append(closeButton);
  document.body.append(root);
  return { root, closeButton };
};

const unregisters: Array<() => void> = [];

afterEach(() => {
  unregisters.splice(0).forEach((unregister) => unregister());
  document.body.replaceChildren();
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
});

describe('reloadSurfaces last touched', () => {
  it('keeps the owning surface when the touched control is removed', () => {
    const { root, closeButton } = mountPane();
    unregisters.push(
      reloadSurfaces.register({
        key: 'pane',
        surface: { isMain: false, hasNativeView: true, root: () => root, reload: () => undefined },
      }),
    );

    closeButton.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    closeButton.remove();

    expect(reloadSurfaces.lastTouched()).toBe(root);
  });

  it('remembers a touch outside every surface as itself', () => {
    const { root, closeButton } = mountPane();
    unregisters.push(
      reloadSurfaces.register({
        key: 'pane',
        surface: { isMain: false, hasNativeView: true, root: () => root, reload: () => undefined },
      }),
    );
    const outside = document.createElement('button');
    document.body.append(outside);

    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    expect(reloadSurfaces.lastTouched()).toBe(outside);
    expect(closeButton.isConnected).toBe(true);
  });

  it('forgets a touched element that left the page outside any surface', () => {
    const outside = document.createElement('button');
    document.body.append(outside);

    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    outside.remove();

    expect(reloadSurfaces.lastTouched()).toBeNull();
  });
});
