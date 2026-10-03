const CONTAINER_VARIANT = /^@(max|min)-\[(\d+)px\]:([\w-]+)$/;

const HIDING = new Set(['hidden', 'sr-only']);
const SHOWING = new Set(['block', 'inline', 'inline-flex', 'flex', 'grid', 'not-sr-only']);

type AtParams = {
  readonly element: Element;
  readonly width: number;
};

const isHiddenAt = ({ element, width }: AtParams): boolean => {
  const tokens = (element.getAttribute('class') ?? '').split(/\s+/);
  return tokens.reduce((hidden, token) => {
    const match = CONTAINER_VARIANT.exec(token);
    if (match === null) {
      return hidden || HIDING.has(token);
    }
    const [, bound, px, utility] = match;
    const limit = Number(px);
    const applies = bound === 'max' ? width < limit : width >= limit;
    if (!applies || utility === undefined) {
      return hidden;
    }
    if (HIDING.has(utility)) {
      return true;
    }
    return SHOWING.has(utility) ? false : hidden;
  }, false);
};

type ViewParams = {
  readonly root: Element;
  readonly width: number;
};

const shownAt = ({ root, width }: ViewParams): boolean => {
  for (let node: Element | null = root; node !== null; node = node.parentElement) {
    if (isHiddenAt({ element: node, width })) {
      return false;
    }
  }
  return true;
};

const textAt = ({ root, width }: ViewParams): string => {
  if (isHiddenAt({ element: root, width })) {
    return '';
  }
  return Array.from(root.childNodes)
    .map((child) => {
      if (child.nodeType === child.TEXT_NODE) {
        return child.textContent ?? '';
      }
      return child instanceof Element ? textAt({ root: child, width }) : '';
    })
    .join('');
};

export const visibleTextAt = ({ root, width }: ViewParams): string =>
  shownAt({ root, width }) ? textAt({ root, width }) : '';

type ShownParams = ViewParams & {
  readonly selector: string;
};

export const shownElementsAt = ({ root, width, selector }: ShownParams): ReadonlyArray<Element> =>
  Array.from(root.querySelectorAll(selector)).filter((element) =>
    shownAt({ root: element, width }),
  );
