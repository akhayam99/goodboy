import type { BrowserTabFacts } from './types';

type Params = {
  readonly a: ReadonlyArray<BrowserTabFacts>;
  readonly b: ReadonlyArray<BrowserTabFacts>;
};

export const sameFacts = ({ a, b }: Params): boolean =>
  a.length === b.length &&
  a.every((fact, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      other.id === fact.id &&
      other.url === fact.url &&
      other.state === fact.state &&
      other.title === fact.title
    );
  });
