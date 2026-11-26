import type { BrowserPickedElement } from './types';

type Params = {
  readonly element: BrowserPickedElement;
};

export const elementNameOf = ({ element }: Params): string => element.component ?? element.label;
