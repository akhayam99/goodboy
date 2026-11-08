import { holdAppScrollAt } from './holdAppScrollAt';

type Params = {
  readonly element: Element | null | undefined;
  readonly block?: ScrollLogicalPosition;
  readonly behavior?: ScrollBehavior;
};

export const appScrollIntoView = ({ element, block, behavior }: Params): void => {
  if (element === null || element === undefined || typeof element.scrollIntoView !== 'function') {
    return;
  }
  holdAppScrollAt({ element });
  element.scrollIntoView({
    ...(block !== undefined && { block }),
    ...(behavior !== undefined && { behavior }),
  });
};
