type Params = {
  readonly root: Document;
};

export const setupPlace = ({ root }: Params): string | null =>
  root.querySelector('[aria-label="Goodboy setup"]')?.getAttribute('data-step') ?? null;
