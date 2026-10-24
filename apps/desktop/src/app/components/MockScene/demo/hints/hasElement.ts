type Params = {
  readonly root: Document;
  readonly selector: string;
};

export const hasElement = ({ root, selector }: Params): boolean =>
  root.querySelector(selector) !== null;
