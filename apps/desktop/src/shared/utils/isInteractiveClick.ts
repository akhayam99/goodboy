type Params = {
  readonly target: EventTarget | null;
};

export const isInteractiveClick = ({ target }: Params): boolean => {
  if (
    target instanceof Element &&
    target.closest('a, button, img, input, [data-no-edit]') != null
  ) {
    return true;
  }
  const selection = window.getSelection();
  return selection != null && selection.toString() !== '';
};
