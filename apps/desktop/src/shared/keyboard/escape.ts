type Layer = {
  readonly handler: () => void;
};

const stack: Layer[] = [];
let listening = false;

const onKeyDown = (event: KeyboardEvent): void => {
  if (event.code !== 'Escape' || event.defaultPrevented || event.isComposing) {
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return;
  }
  const top = stack[stack.length - 1];
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

export const registerEscapeLayer = (handler: () => void): (() => void) => {
  const layer: Layer = { handler };
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
