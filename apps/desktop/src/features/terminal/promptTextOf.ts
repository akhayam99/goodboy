import { shellQuote } from '../suggestions/signals/shellQuote';
import { typedCommandOf } from './typedCommandOf';

type Params = {
  readonly text: string;
  readonly cwd: string;
  readonly shellCwd: string | null;
};

export const promptTextOf = ({ text, cwd, shellCwd }: Params): string => {
  const command = typedCommandOf({ text });
  if (shellCwd === cwd) {
    return command;
  }
  return `cd ${shellQuote({ text: cwd })} && ${command}`;
};
