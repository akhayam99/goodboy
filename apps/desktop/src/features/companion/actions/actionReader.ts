import { MAX_TEXT_LENGTH } from './actionLimits';

const MAX_ID_LENGTH = 128;

type NameParams = {
  readonly name: string;
};

type PickParams<Option extends string> = {
  readonly name: string;
  readonly options: ReadonlyArray<Option>;
};

export type Reader = {
  readonly id: (params: NameParams) => string | null;
  readonly text: (params: NameParams) => string | null;
  readonly int: (params: NameParams) => number | null;
  readonly number: (params: NameParams) => number | null;
  readonly bool: (params: NameParams) => boolean | null;
  readonly list: (params: NameParams) => ReadonlyArray<unknown> | null;
  readonly pick: <Option extends string>(params: PickParams<Option>) => Option | null;
};

type ReaderParams = {
  readonly record: Readonly<Record<string, unknown>>;
};

export const readerOf = ({ record }: ReaderParams): Reader => ({
  id: ({ name }) => {
    const value = record[name];
    return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
      ? value
      : null;
  },
  text: ({ name }) => {
    const value = record[name];
    return typeof value === 'string' && value.length <= MAX_TEXT_LENGTH ? value : null;
  },
  int: ({ name }) => {
    const value = record[name];
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
  },
  number: ({ name }) => {
    const value = record[name];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  },
  bool: ({ name }) => {
    const value = record[name];
    return typeof value === 'boolean' ? value : null;
  },
  list: ({ name }) => {
    const value = record[name];
    return Array.isArray(value) ? value : null;
  },
  pick: ({ name, options }) => options.find((option) => option === record[name]) ?? null,
});
