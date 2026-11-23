import { shellQuote } from '../suggestions/signals/shellQuote';
import { typedCommandOf } from './typedCommandOf';

type Params = {
  readonly text: string;
  readonly cwd: string;
};

export const promptTextOf = ({ text, cwd }: Params): string =>
  `cd ${shellQuote({ text: cwd })} && ${typedCommandOf({ text })}`;
