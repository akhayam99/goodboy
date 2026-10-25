type Params = {
  readonly anchor: Element;
  readonly view: Window;
};

type ElementParams = {
  readonly element: Element;
};

type RegionParams = ElementParams & {
  readonly view: Window;
};

const CONTAINER =
  '[data-demo-focus],form,section,article,fieldset,li,[role="dialog"],[role="group"],[role="region"],[role="tabpanel"],[role="listitem"],[role="row"]';
const MAX_SHARE = 0.6;
const MIN_GROWTH = 1.3;
const BAND_MIN_WIDTH = 0.5;
const BAND_MAX_HEIGHT = 0.2;

const areaOf = ({ element }: ElementParams): number => {
  const box = element.getBoundingClientRect();
  return box.width * box.height;
};

const isSurface = ({ element, view }: RegionParams): boolean => {
  const style = view.getComputedStyle(element);
  return parseFloat(style.borderTopWidth) > 0 && parseFloat(style.borderTopLeftRadius) > 0;
};

const isBand = ({ element, view }: RegionParams): boolean => {
  const box = element.getBoundingClientRect();
  return (
    box.width >= view.innerWidth * BAND_MIN_WIDTH &&
    box.height <= view.innerHeight * BAND_MAX_HEIGHT
  );
};

type PassParams = Params & {
  readonly isMatch: (params: RegionParams) => boolean;
};

const climb = ({ anchor, view, isMatch }: PassParams): Element | null => {
  const anchorArea = areaOf({ element: anchor });
  const viewArea = view.innerWidth * view.innerHeight;
  for (let parent = anchor.parentElement; parent !== null; parent = parent.parentElement) {
    if (!isMatch({ element: parent, view })) {
      continue;
    }
    const area = areaOf({ element: parent });
    if (area > viewArea * MAX_SHARE) {
      return null;
    }
    if (area >= anchorArea * MIN_GROWTH) {
      return parent;
    }
  }
  return null;
};

const isContainer = ({ element, view }: RegionParams): boolean =>
  element.matches(CONTAINER) || isSurface({ element, view });

export const focusRegionOf = ({ anchor, view }: Params): Element | null =>
  climb({ anchor, view, isMatch: isContainer }) ?? climb({ anchor, view, isMatch: isBand });
