// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useBackdropParam } from './index';

const strength = (): string =>
  document.documentElement.style.getPropertyValue('--app-backdrop-strength');

type VisitParams = {
  readonly search: string;
};

const visit = ({ search }: VisitParams): void => {
  window.history.replaceState(null, '', `/${search}`);
};

afterEach(() => {
  cleanup();
  visit({ search: '' });
  document.documentElement.style.removeProperty('--app-backdrop-strength');
});

describe('useBackdropParam', () => {
  it('sets the backdrop strength a scene url names', () => {
    visit({ search: '?scene=c02-shell-overview&backdrop=6' });

    renderHook(() => useBackdropParam());

    expect(strength()).toBe('6');
  });

  it('leaves the default strength when the url names none', () => {
    visit({ search: '?scene=c02-shell-overview' });

    renderHook(() => useBackdropParam());

    expect(strength()).toBe('');
  });

  it.each(['glow', '-3', '80', ''])('ignores a strength it cannot read (%s)', (value) => {
    visit({ search: `?scene=frame&backdrop=${value}` });

    renderHook(() => useBackdropParam());

    expect(strength()).toBe('');
  });

  it('drops the strength once the scene unmounts', () => {
    visit({ search: '?scene=frame&backdrop=3' });

    const { unmount } = renderHook(() => useBackdropParam());
    unmount();

    expect(strength()).toBe('');
  });
});
