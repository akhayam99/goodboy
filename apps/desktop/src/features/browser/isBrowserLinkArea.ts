type Params = {
  readonly anchor: Element;
};

export const isBrowserLinkArea = ({ anchor }: Params): boolean =>
  anchor.closest('[data-browser-links]') !== null;
