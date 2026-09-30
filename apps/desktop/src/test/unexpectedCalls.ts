import { format } from 'node:util';

const MAX_ARGS_LENGTH = 120;

export type UnexpectedCallSource = 'db' | 'invoke';

const calls: string[] = [];

const describeArgs = (args: ReadonlyArray<unknown>): string => {
  if (args.length === 0) {
    return '()';
  }
  const text = args
    .map((arg) => format('%j', arg))
    .join(', ')
    .replace(/\s+/g, ' ');
  return `(${text.length > MAX_ARGS_LENGTH ? `${text.slice(0, MAX_ARGS_LENGTH)}...` : text})`;
};

export const recordUnexpectedCall = ({
  source,
  name,
  args,
}: {
  readonly source: UnexpectedCallSource;
  readonly name: string;
  readonly args: ReadonlyArray<unknown>;
}): void => {
  calls.push(`${source}: ${name}${describeArgs(args)}`);
};

export const drainUnexpectedCalls = (): ReadonlyArray<string> => calls.splice(0, calls.length);
