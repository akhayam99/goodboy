const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';

const TERMINAL_SELECTOR = '.xterm';

type Params = {
  readonly target: EventTarget | null;
  readonly selection: Selection | null;
};

const hasSelectionInside = ({
  element,
  selection,
}: {
  readonly element: Element;
  readonly selection: Selection | null;
}): boolean => {
  if (selection === null || selection.isCollapsed || selection.toString().trim() === '') {
    return false;
  }
  const { anchorNode, focusNode } = selection;
  return (
    (anchorNode !== null && element.contains(anchorNode)) ||
    (focusNode !== null && element.contains(focusNode)) ||
    selection.containsNode(element, true)
  );
};

export const keepsNativeMenu = ({ target, selection }: Params): boolean => {
  if (!(target instanceof Element)) {
    return false;
  }
  if (target.closest(EDITABLE_SELECTOR) !== null || target.closest(TERMINAL_SELECTOR) !== null) {
    return true;
  }
  return hasSelectionInside({ element: target, selection });
};
