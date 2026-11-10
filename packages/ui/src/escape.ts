type Layer = {
  readonly handler: () => void;
  readonly isBase: boolean;
  readonly isSuspended: () => boolean;
};

const stack: Layer[] = [];
let listening = false;

const NEVER_SUSPENDED = (): boolean => false;

const liveLayers = (): Layer[] => stack.filter((layer) => !layer.isSuspended());

const topLayer = (): Layer | undefined => {
  const live = liveLayers();
  return live.filter((layer) => !layer.isBase).at(-1) ?? live.at(-1);
};

const onKeyDown = (event: KeyboardEvent): void => {
  if (
    (event.code !== 'Escape' && event.key !== 'Escape') ||
    event.defaultPrevented ||
    event.isComposing
  ) {
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return;
  }
  const top = topLayer();
  if (top == null) {
    return;
  }
  event.preventDefault();
  top.handler();
};

const startListening = (): void => {
  if (listening || typeof window === 'undefined') {
    return;
  }
  window.addEventListener('keydown', onKeyDown);
  listening = true;
};

const stopListening = (): void => {
  if (!listening || stack.length > 0 || typeof window === 'undefined') {
    return;
  }
  window.removeEventListener('keydown', onKeyDown);
  listening = false;
};

export const registerEscapeLayer = (
  handler: () => void,
  isBase = false,
  isSuspended: () => boolean = NEVER_SUSPENDED,
): (() => void) => {
  const layer: Layer = { handler, isBase, isSuspended };
  stack.push(layer);
  startListening();
  return () => {
    const index = stack.indexOf(layer);
    if (index !== -1) {
      stack.splice(index, 1);
    }
    stopListening();
  };
};

export const escapeLayerCount = (): number => stack.length;

export const transientEscapeLayerCount = (): number =>
  liveLayers().filter((layer) => !layer.isBase).length;

export const dismissTopEscapeLayer = (): void => {
  topLayer()?.handler();
};
