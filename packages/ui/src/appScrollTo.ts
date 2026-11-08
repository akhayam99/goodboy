import { holdAppScrollAt } from './holdAppScrollAt';

type Params = {
  readonly viewport: HTMLElement;
  readonly top: number;
  readonly behavior?: ScrollBehavior;
};

export const appScrollTo = ({ viewport, top, behavior }: Params): void => {
  holdAppScrollAt({ element: viewport });
  if (behavior === undefined) {
    viewport.scrollTop = top;
    return;
  }
  viewport.scrollTo({ top, behavior });
};
