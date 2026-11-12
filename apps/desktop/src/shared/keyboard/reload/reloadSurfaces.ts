import type { ReloadSurface } from './types';

type RegisterParams = {
  readonly key: string;
  readonly surface: ReloadSurface;
};

type TouchParams = {
  readonly target: EventTarget | null;
};

const surfaces = new Map<string, ReloadSurface>();
let lastTouched: Element | null = null;
let isListening = false;

const noteTouch = ({ target }: TouchParams): void => {
  if (!(target instanceof Element)) {
    lastTouched = null;
    return;
  }
  const owner = [...surfaces.values()].find((surface) => surface.root()?.contains(target) === true);
  lastTouched = owner?.root() ?? target;
};

const listen = (): void => {
  if (isListening || typeof window === 'undefined') {
    return;
  }
  window.addEventListener('pointerdown', noteTouch, true);
  window.addEventListener('focusin', noteTouch, true);
  isListening = true;
};

export const reloadSurfaces = {
  register: ({ key, surface }: RegisterParams): (() => void) => {
    listen();
    surfaces.set(key, surface);
    return () => {
      if (surfaces.get(key) === surface) {
        surfaces.delete(key);
      }
    };
  },
  list: (): ReadonlyArray<ReloadSurface> => [...surfaces.values()],
  lastTouched: (): Element | null => (lastTouched?.isConnected === true ? lastTouched : null),
};
