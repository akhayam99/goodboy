type Params = {
  readonly target: EventTarget;
};

export const isKeyboardFocus = ({ target }: Params): boolean => {
  if (!(target instanceof Element)) {
    return true;
  }
  try {
    return target.matches(':focus-visible');
  } catch {
    return true;
  }
};
