// @vitest-environment happy-dom

import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useHomeToRailMorph } from './index';

const Fixture = () => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const morph = useHomeToRailMorph({ stageRef });
  const [isHome, setIsHome] = useState(true);
  const open = () => {
    morph.begin();
    setIsHome(false);
  };
  return (
    <div ref={stageRef}>
      {isHome ? (
        <section data-settings-group="app">
          <button type="button" data-settings-page="app:general" onClick={open}>
            General
          </button>
          <button type="button" data-settings-page="app:storage" onClick={open}>
            Storage
          </button>
        </section>
      ) : (
        <nav aria-label="Settings scopes">
          <div data-settings-group="app">
            <button type="button">App</button>
            <ul>
              <li data-settings-page="app:general">
                <button type="button">General</button>
              </li>
            </ul>
          </div>
        </nav>
      )}
    </div>
  );
};

const reducedMotion = (matches: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );

const morphLayer = () => document.querySelector('[data-settings-morph]');

const rail = () => screen.getByRole('navigation', { name: 'Settings scopes' });

let finishAll: () => void = () => undefined;
const animateSpy = vi.fn();
const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');

beforeEach(() => {
  const finished = new Promise<void>((resolve) => {
    finishAll = resolve;
  });
  animateSpy.mockReset();
  animateSpy.mockImplementation(() => ({ finished, cancel: vi.fn() }));
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: animateSpy,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalAnimate === undefined) {
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
    return;
  }
  Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
});

describe('useHomeToRailMorph', () => {
  it('flies every card toward the rail, hides the rail meanwhile and cleans up at the end', async () => {
    reducedMotion(false);
    render(<Fixture />);

    fireEvent.click(screen.getByRole('button', { name: 'Storage' }));

    expect(morphLayer()?.getAttribute('aria-hidden')).toBe('true');
    expect(morphLayer()?.querySelectorAll('button')).toHaveLength(2);
    expect(rail().style.opacity).toBe('0');

    await act(async () => {
      finishAll();
      await Promise.resolve();
    });

    expect(morphLayer()).toBeNull();
    expect(rail().style.opacity).toBe('');
  });

  it('switches at once when the system asks for reduced motion', () => {
    reducedMotion(true);
    render(<Fixture />);

    fireEvent.click(screen.getByRole('button', { name: 'Storage' }));

    expect(morphLayer()).toBeNull();
    expect(rail().style.opacity).toBe('');
    expect(animateSpy).not.toHaveBeenCalled();
  });
});
