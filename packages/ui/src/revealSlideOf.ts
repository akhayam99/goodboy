type Params = {
  readonly element: Element;
};

const BODY_SELECTOR = '[data-slot="reveal-body"]';

export const revealSlideOf = ({ element }: Params): number => {
  let slide = 0;
  let body = element.closest(BODY_SELECTOR);
  while (body !== null) {
    const region = body.parentElement;
    if (region !== null) {
      slide += body.getBoundingClientRect().top - region.getBoundingClientRect().top;
    }
    body = region?.closest(BODY_SELECTOR) ?? null;
  }
  return slide;
};
