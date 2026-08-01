import type { ReactNode } from 'react';

export type DetailEntry = {
  readonly key: string;
  readonly label: string;
  readonly node: ReactNode;
};

export type ResolvedDetailFields = ReadonlyArray<DetailEntry> & {
  readonly __brand: 'ResolvedDetailFields';
};

type RenderParams<T> = {
  readonly entity: T;
};

type SingleField<T> = {
  readonly kind: 'field';
  readonly key: string;
  readonly label: string;
  readonly render: (params: RenderParams<T>) => ReactNode;
};

type GroupField<T> = {
  readonly kind: 'group';
  readonly key: string;
  readonly expand: (params: RenderParams<T>) => ReadonlyArray<DetailEntry>;
};

type DetailField<T> = SingleField<T> | GroupField<T>;

export type DetailFieldRegistry<T> = ReadonlyArray<DetailField<T>>;
