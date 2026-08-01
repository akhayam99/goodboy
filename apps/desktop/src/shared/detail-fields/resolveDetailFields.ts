import { isValidElement, type ReactNode } from 'react';
import type { DetailEntry, DetailFieldRegistry } from './types';

const resolvedDetailFields: unique symbol = Symbol('resolvedDetailFields');

export type ResolvedDetailFields = ReadonlyArray<DetailEntry> & {
  readonly [resolvedDetailFields]: boolean;
};

type ChildrenProps = {
  readonly children?: ReactNode;
};

const isPresent = (node: ReactNode): boolean => {
  if (node == null || typeof node === 'boolean') {
    return false;
  }
  if (typeof node === 'string') {
    return node.trim() !== '';
  }
  if (typeof node === 'number') {
    return node !== 0;
  }
  if (Array.isArray(node)) {
    return node.some((child: ReactNode) => isPresent(child));
  }
  if (isValidElement<ChildrenProps>(node) && node.props.children !== undefined) {
    return isPresent(node.props.children);
  }
  return true;
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
    entries.filter((entry) => isPresent(entry.node)),
    {
      [resolvedDetailFields]: true,
    },
  );
};
