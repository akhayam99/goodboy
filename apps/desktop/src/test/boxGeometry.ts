const SPACING_PX = 4;

const NO_STATES: ReadonlySet<string> = new Set();

const tokensOf = (element: Element): ReadonlyArray<string> =>
  (element.getAttribute('class') ?? '').split(/\s+/).filter((token) => token !== '');

const valuePx = (raw: string): number | null => {
  const arbitrary = /^\[(-?\d+(?:\.\d+)?)px\]$/.exec(raw);
  if (arbitrary !== null) {
    return Number(arbitrary[1]);
  }
  if (raw === 'px') {
    return 1;
  }
  const scale = Number(raw);
  return Number.isFinite(scale) ? scale * SPACING_PX : null;
};

type SpacingParams = {
  readonly element: Element;
  readonly property: string;
  readonly states?: ReadonlySet<string>;
};

export const spacingOf = ({ element, property, states = NO_STATES }: SpacingParams): number => {
  let found = 0;
  for (const token of tokensOf(element)) {
    const parts = token.split(':');
    const utility = parts.pop() ?? '';
    if (!parts.every((variant) => states.has(variant))) {
      continue;
    }
    const match = /^(-?)([a-z]+)-(.+)$/.exec(utility);
    if (match === null || match[2] !== property) {
      continue;
    }
    const px = valuePx(match[3] ?? '');
    if (px !== null) {
      found = match[1] === '-' ? -px : px;
    }
  }
  return found;
};

export const borderOf = ({ element }: { readonly element: Element }): number =>
  tokensOf(element).includes('border') ? 1 : 0;
