import type { ReactNode } from 'react';
import type { DetailFieldRegistry, ResolvedDetailFields } from './types';

const isPresent = (node: ReactNode): boolean => {
  if (node == null || node === '' || node === false) {
    return false;
  }
  if (Array.isArray(node)) {
    return node.length > 0;
  }
  return true;
};

type Params<T> = {
  readonly registry: DetailFieldRegistry<T>;
  readonly entity: T;
  readonly limit?: number;
};

export const resolveDetailFields = <T>({
  registry,
  entity,
  limit,
}: Params<T>): ResolvedDetailFields => {
  const entries = registry.flatMap((field) => {
    if (field.kind === 'group') {
      return field.expand({ entity });
    }
    return [{ key: field.key, label: field.label, node: field.render({ entity }) }];
  });
  const present = entries.filter((entry) => isPresent(entry.node));
  const kept = limit == null ? present : present.slice(0, limit);
  return Object.assign(kept, { __brand: 'ResolvedDetailFields' as const });
};
