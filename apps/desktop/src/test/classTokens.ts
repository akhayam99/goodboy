type Params = {
  readonly element: Element | null;
  readonly spec: string;
};

export const carriesSpec = ({ element, spec }: Params): boolean => {
  if (element === null) {
    return false;
  }
  const tokens = (element.getAttribute('class') ?? '').split(/\s+/u);
  return spec.split(/\s+/u).every((token) => tokens.includes(token));
};
