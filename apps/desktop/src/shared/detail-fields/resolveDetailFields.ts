import { isPresentNode } from './isPresentNode';
import type { DetailEntry, DetailFieldRegistry } from './types';

const resolvedDetailFields: unique symbol = Symbol('resolvedDetailFields');

export type ResolvedDetailFields = ReadonlyArray<DetailEntry> & {
  readonly [resolvedDetailFields]: boolean;
};

type Params<T> = {
  readonly registry: DetailFieldRegistry<T>;
  readonly entity: T;
};

export const resolveDetailFields = <T>({ registry, entity }: Params<T>): ResolvedDetailFields => {
  const entries = registry.flatMap((field) => {
    if (field.kind === 'group') {
      return field.expand({ entity });
    }
    return [{ key: field.key, label: field.label, node: field.render({ entity }) }];
  });
  return Object.assign(
    entries.filter((entry) => isPresentNode({ node: entry.node })),
    {
      [resolvedDetailFields]: true,
    },
  );
};
