import { nounFor } from './nounFor';

type Params = {
  readonly count: number;
  readonly one: string;
  readonly many?: string;
};

export const countNoun = ({ count, one, many }: Params): string =>
  `${count} ${nounFor({ count, one, many })}`;
