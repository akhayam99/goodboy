import { appScrollIntoView } from '@goodboy/ui';

type Params = {
  readonly rows: ReadonlyMap<number, HTMLElement>;
  readonly numbers: Iterable<number>;
};

export const revealDecisionRow = ({ rows, numbers }: Params): void => {
  const first = [...numbers].map((number) => rows.get(number)).find((row) => row !== undefined);
  appScrollIntoView({ element: first, block: 'nearest', behavior: 'smooth' });
};
