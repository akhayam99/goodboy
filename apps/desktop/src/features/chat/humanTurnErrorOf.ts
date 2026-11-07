import { formatErrorForHumans } from './formatErrorForHumans';

type Params = {
  readonly message: string;
};

export const humanTurnErrorOf = ({ message }: Params): string => {
  const human = formatErrorForHumans({ message });
  return human.body === null || human.body === '' ? message : human.body;
};
