import { DRAWER_EXIT_MAX_ELEMENTS } from './drawerGeometry';

type ScrollMark = {
  readonly index: number;
  readonly top: number;
  readonly left: number;
};

export type ExitSnapshot = {
  readonly node: Element;
  readonly scrolls: ReadonlyArray<ScrollMark>;
};

type ElementParams = {
  readonly element: Element | null;
};

type MountParams = {
  readonly host: Element;
  readonly snapshot: ExitSnapshot;
};

const UNCLONEABLE = 'canvas, iframe, video, audio, webview';

const isHeavy = (element: Element): boolean => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT);
  let count = 0;
  while (walker.nextNode() !== null) {
    count += 1;
    if (count > DRAWER_EXIT_MAX_ELEMENTS) {
      return true;
    }
  }
  return false;
};

const allOf = (element: Element): ReadonlyArray<Element> => [
  element,
  ...element.querySelectorAll('*'),
];

const scrollsOf = (element: Element): ReadonlyArray<ScrollMark> =>
  allOf(element).flatMap((node, index) =>
    node.scrollTop > 0 || node.scrollLeft > 0
      ? [{ index, top: node.scrollTop, left: node.scrollLeft }]
      : [],
  );

export const exitSnapshotOf = ({ element }: ElementParams): ExitSnapshot | null => {
  if (element === null || element.querySelector(UNCLONEABLE) !== null || isHeavy(element)) {
    return null;
  }
  const node = element.cloneNode(true);
  if (!(node instanceof Element)) {
    return null;
  }
  allOf(node).forEach((item) => item.removeAttribute('id'));
  return { node, scrolls: scrollsOf(element) };
};

export const mountExitSnapshot = ({ host, snapshot }: MountParams): void => {
  host.appendChild(snapshot.node);
  const all = allOf(snapshot.node);
  snapshot.scrolls.forEach((mark) => {
    const target = all[mark.index];
    if (target === undefined) {
      return;
    }
    target.scrollTop = mark.top;
    target.scrollLeft = mark.left;
  });
};
