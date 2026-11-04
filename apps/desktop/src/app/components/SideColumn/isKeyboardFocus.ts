type Params = {
  readonly element: HTMLElement;
};

export const isKeyboardFocus = ({ element }: Params): boolean => {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
};
